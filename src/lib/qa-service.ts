/**
 * Servicio de Q&A — PageIndex + Qwen3-Next 80B
 *
 * Arquitectura de 1 llamada LLM por query:
 *   1. Regex intent extraction (0 LLM calls)
 *   2. Si query específica (página/sección/párrafo) → consulta directa a Postgres (0 LLM calls)
 *   3. Qwen3-Next 80B con contexto completo del documento → respuesta (1 LLM call)
 *
 * NIM tiene 40 RPH por clave. Con 1 llamada por query → 40 queries/hora.
 * Qwen3-Next 80B (MoE, 3B activos): ~2s para documentos de 50K+ chars.
 * Kimi K2.6 descartado: 179s para "hola" en NIM — inutilizable.
 */

import { prisma } from './db';
import { nimService } from './nim';

export interface QAContext {
  text: string;
  page?: number;
  section?: string;
  start_index?: number;
  end_index?: number;
}

export interface QAResult {
  answer: string;
  context: QAContext[];
  entities: any[];
  relations: any[];
  references: {
    page?: number;
    section?: string;
    title?: string;
  }[];
}

export class QAService {
  async answerSpecificQuestion(
    query: string,
    documentId: string,
    documentName: string
  ): Promise<QAResult> {
    console.log(`[QA] Pregunta: "${query}"`);

    // 1. Extracción de intención por RegEx — preciso para queries con página/sección/párrafo.
    // No se usa LLM aquí: 40 RPH en NIM no justifica gastar una llamada en intent extraction.
    const regexIntent = this.extractQueryIntent(query);
    const intent = {
      page: regexIntent.page,
      section: regexIntent.section,
      paragraph: regexIntent.paragraph,
      isSpecific: regexIntent.isSpecific,
      originalQuery: query,
    };
    console.log(`[QA] Intención (RegEx):`, {
      page: intent.page,
      section: intent.section,
      isSpecific: intent.isSpecific,
    });

    // 2. Obtener contexto de PageIndex (0 LLM calls)
    const pageIndexContext = await this.getPageIndexByIntent(intent, documentId);

    // 3. Kimi K2.6 con contexto completo → respuesta (1 LLM call)
    const entities: any[] = [];
    const answer = await this.generateContextualAnswer(intent.originalQuery, pageIndexContext, documentName);

    return {
      answer,
      context: pageIndexContext,
      entities,
      relations: [],
      references: pageIndexContext.map(c => ({
        page: c.page,
        section: c.section,
        title: c.text.split('\n')[0]?.slice(0, 100),
      })),
    };
  }

  /**
   * Extrae TODOS los constraints de la pregunta simultáneamente (página, sección, párrafo).
   * No es exclusivo: "párrafo 4 de la sección 2 en la página 15" devuelve los tres.
   */
  private extractQueryIntent(query: string): {
    page?: number;
    section?: string;
    paragraph?: number;
    isSpecific: boolean;
    originalQuery: string;
  } {
    const lowerQuery = query.toLowerCase();

    // Números ordinales en español
    const ordinalMap: Record<string, number> = {
      'primer': 1, 'primero': 1, 'primera': 1,
      'segundo': 2, 'segunda': 2,
      'tercer': 3, 'tercero': 3, 'tercera': 3,
      'cuarto': 4, 'cuarta': 4,
      'quinto': 5, 'quinta': 5,
      'sexto': 6, 'sexta': 6,
      'séptimo': 7, 'septimo': 7, 'séptima': 7,
      'octavo': 8, 'octava': 8,
      'noveno': 9, 'novena': 9,
      'décimo': 10, 'decimo': 10, 'décima': 10,
    };

    // Página
    const pageMatch = lowerQuery.match(/p[aá]ginas?\s+(\d+)|p[aá]g\.?\s*(\d+)/i);
    const page = pageMatch ? parseInt(pageMatch[1] || pageMatch[2]) : undefined;

    // Sección / capítulo: solo matchea identificadores numéricos o romanos (ej: "1", "1.2", "II-A")
    // Evita falsos positivos con adjetivos españoles ("exacta", "actual", etc.)
    const sectionMatch = lowerQuery.match(
      /secc?(?:i[oó]n)?\s+(\d[A-Z0-9.-]*|[IVX]{1,6}(?:[.-][A-Z0-9]+)*)|cap[íi]tulos?\s+(\d[A-Z0-9.-]*|[IVX]{1,6}(?:[.-][A-Z0-9]+)*)/i
    );
    const section = sectionMatch ? (sectionMatch[1] || sectionMatch[2]) : undefined;

    // Párrafo — número cardinal o nombre ordinal
    let paragraph: number | undefined;
    const paraNumMatch = lowerQuery.match(/p[aá]rrafo?s?\s+(\d+)/i);
    if (paraNumMatch) {
      paragraph = parseInt(paraNumMatch[1]);
    } else {
      const paraWordMatch = lowerQuery.match(/(\w+)\s+p[aá]rrafo?s?/i);
      if (paraWordMatch) {
        paragraph = ordinalMap[paraWordMatch[1].toLowerCase()];
      }
    }

    const isSpecific = page !== undefined || section !== undefined || paragraph !== undefined;

    return { page, section, paragraph, isSpecific, originalQuery: query };
  }

  /**
   * Extrae párrafos de un bloque de texto.
   */
  private extractParagraphs(text: string): string[] {
    let parts = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length >= 2) return parts;

    parts = text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length >= 2) return parts;

    parts = text.split(/\n/).map(p => p.trim()).filter(p => p.length > 20);
    return parts.length >= 1 ? parts : [text];
  }

  /**
   * Obtiene contexto de PageIndex.
   * - Query específica (página/sección/párrafo) → consulta directa a Postgres, 0 LLM calls
   * - Query general → todos los nodos del documento, 0 LLM calls
   *   Kimi K2.6 (1M tokens) puede recibir el documento completo en el paso siguiente.
   */
  private async getPageIndexByIntent(
    intent: { page?: number; section?: string; paragraph?: number; isSpecific: boolean },
    documentId: string,
  ): Promise<QAContext[]> {
    const contexts: QAContext[] = [];

    try {
      if (intent.isSpecific) {
        const whereClause: any = { documentId };

        if (intent.page) {
          whereClause.OR = [
            { page: intent.page },
            {
              AND: [
                { page: { lte: intent.page } },
                { metadata: { path: ['endPage'], gte: intent.page } },
              ],
            },
          ];
        }

        if (intent.section) {
          whereClause.title = { contains: intent.section, mode: 'insensitive' as const };
          delete whereClause.OR;
        }

        const nodes = await prisma.pageIndex.findMany({
          where: whereClause,
          orderBy: [{ level: 'asc' }, { page: 'asc' }],
          take: 20,
        });

        if (intent.paragraph !== undefined && nodes.length > 0) {
          const fullText = nodes.map(n => n.content || '').join('\n\n');
          const paragraphs = this.extractParagraphs(fullText);
          const idx = intent.paragraph - 1;

          if (idx >= 0 && idx < paragraphs.length) {
            contexts.push({
              text: paragraphs[idx],
              page: nodes[0]?.page ?? intent.page,
              section: intent.section
                ? nodes[0]?.title ?? undefined
                : `Párrafo ${intent.paragraph}${intent.page ? ` (pág. ${intent.page})` : ''}`,
            });
          } else {
            console.warn(`[QA] Párrafo ${intent.paragraph} fuera de rango (total: ${paragraphs.length}), usando sección completa`);
            nodes.forEach(n => {
              if (n.content && n.content.length > 20) {
                contexts.push({ text: `${n.title}\n${n.content}`, page: n.page ?? undefined, section: n.title });
              }
            });
          }
        } else {
          nodes.forEach(n => {
            if (n.content && n.content.length > 20) {
              contexts.push({ text: `${n.title}\n${n.content}`, page: n.page ?? undefined, section: n.title });
            }
          });
        }
      }

      // Para queries generales (o específicas sin resultados): cargar todos los nodos.
      // Qwen3-Next 80B maneja 56K+ chars en ~2s — el documento completo entra en un solo prompt.
      if (contexts.length === 0) {
        console.log(`[QA] Cargando todos los nodos del documento para contexto completo`);
        const allNodes = await prisma.pageIndex.findMany({
          where: { documentId },
          orderBy: [{ page: 'asc' }, { level: 'asc' }],
        });

        for (const n of allNodes) {
          const meta = n.metadata as Record<string, unknown> | null;
          if (meta?.isPageNode === true) continue; // excluir nodos "Página N" (auxiliares)
          if (!n.content || n.content.length < 20) continue;
          contexts.push({
            text: `${n.title}\n${n.content}`,
            page: n.page ?? undefined,
            section: n.title,
          });
        }
        console.log(`[QA] ${contexts.length} nodos cargados`);
      }
    } catch (error: any) {
      console.error('[QA] Error obteniendo contexto PageIndex:', error.message);
    }

    return contexts;
  }

  /**
   * Genera respuesta con Qwen3-Next 80B.
   * MoE (3B params activos de 80B) — ~2s para documentos de 50K+ chars.
   * Recibe el documento completo en un solo prompt (1 LLM call total por query).
   */
  private async generateContextualAnswer(
    query: string,
    contexts: QAContext[],
    documentName: string,
  ): Promise<string> {
    const pageIndexText = contexts
      .map((c, i) => `### Sección ${i + 1}${c.page ? ` (Página ${c.page})` : ''}${c.section ? ` — ${c.section}` : ''}\n${c.text}`)
      .join('\n\n');

    if (!pageIndexText || pageIndexText.length < 50) {
      return 'No se encontró información suficiente en el documento para responder esta pregunta.';
    }

    console.log(`[QA] Qwen3-Next: ${contexts.length} secciones, ${pageIndexText.length} chars`);

    try {
      return await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'qwen/qwen3-next-80b-a3b-instruct',
        systemPrompt: 'Eres un experto en auditoría ESG para la Secretaría de Economía de México. Responde en español, basándote ÚNICAMENTE en el contenido del documento proporcionado. Si la información no está en el documento, di explícitamente que no se encontró.',
        prompt: `Basándote ÚNICAMENTE en la siguiente información del documento "${documentName}", responde la pregunta de forma clara y completa.\n\nPREGUNTA: ${query}\n\n---\n\n${pageIndexText}`,
        maxTokens: 4096,
        temperature: 0.1,
        timeoutMs: 60_000,
      });
    } catch (error: any) {
      return `Error al generar respuesta: ${error.message}`;
    }
  }
}

export const qaService = new QAService();
