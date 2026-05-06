/**
 * Servicio de Q&A Mejorado que combina PageIndex + FalkorDB
 * 
 * Permite búsquedas específicas por:
 * - Página: "¿Qué hay en la página 4?"
 * - Sección: "¿De qué trata la sección II-A?"
 * - Contenido: "¿Qué dice sobre el sargazo?"
 * - Ubicación exacta: "¿Qué hay en el tercer párrafo de la página 5?"
 *
 * [Mejora] Extracción de intención con Kimi K2 (razonamiento NIM) como
 * pre-procesamiento LLM antes del fallback RegEx.
 */

import { prisma } from './db';
import { falkorDBService } from './falkordb';
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
  /**
   * Responde preguntas específicas sobre ubicación en el documento
   * Ejemplos:
   * - "¿De qué trata el tercer párrafo de la página 4?"
   * - "¿Qué dice la sección II-A?"
   * - "¿Qué hay en la página 5?"
   */
  async answerSpecificQuestion(
    query: string,
    documentId: string,
    documentName: string
  ): Promise<QAResult> {
    console.log(`[QA] Pregunta: "${query}"`);

    // 1a. Extracción de intención con Kimi K2 — captura semántica en lenguaje natural
    const llmIntent = await this.extractQueryIntentLLM(query);

    // 1b. Extracción de intención con RegEx — fallback preciso para queries directas
    const regexIntent = this.extractQueryIntent(query);

    // Fusionar: priorizar RegEx si es específico, de lo contrario usar LLM
    const intent = {
      page: regexIntent.page ?? llmIntent.page,
      section: regexIntent.section ?? llmIntent.section,
      paragraph: regexIntent.paragraph ?? llmIntent.paragraph,
      isSpecific: regexIntent.isSpecific || llmIntent.isSpecific,
      originalQuery: llmIntent.reformulatedQuery || query,
    };
    console.log(`[QA] Intención (RegEx+LLM):`, {
      page: intent.page,
      section: intent.section,
      paragraph: intent.paragraph,
      isSpecific: intent.isSpecific,
      reformulated: intent.originalQuery !== query,
    });

    // 2. Obtener contexto de PageIndex basado en la intención
    const pageIndexContext = await this.getPageIndexByIntent(intent, documentId, intent.originalQuery);

    // 3. Obtener entidades relacionadas de FalkorDB
    const entities = await this.getRelatedEntities(documentId, pageIndexContext);

    // 4. Generar respuesta contextual con LLM
    const answer = await this.generateContextualAnswer(intent.originalQuery, pageIndexContext, entities, documentName);

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
   * [NUEVO] Extrae intención de búsqueda usando Kimi K2 (NVIDIA NIM).
   * Maneja consultas en lenguaje natural complejo que los RegEx no capturan.
   * Siempre retorna un objeto válido aunque falle la llamada al LLM.
   */
  private async extractQueryIntentLLM(query: string): Promise<{
    page?: number;
    section?: string;
    paragraph?: number;
    isSpecific: boolean;
    reformulatedQuery?: string;
  }> {
    const apiKey = process.env.NVIDIA_INTENT_API_KEY || process.env.NVIDIA_API_KEY || '';
    const model = process.env.NVIDIA_INTENT_MODEL || 'moonshotai/kimi-k2-instruct-0905';
    const baseUrl = 'https://integrate.api.nvidia.com/v1';

    const systemPrompt = `You are a document query analyzer. Given a question in Spanish about a document, extract ONLY the structured intent.
Respond ONLY with a valid JSON object — no text before or after:
{
  "page": <number | null>,
  "section": <string identifier like "1", "II-A", "3.2" | null>,
  "paragraph": <number | null>,
  "isSpecific": <true if any field above is non-null OR the question targets a specific named section, false otherwise>,
  "reformulatedQuery": <cleaned, concise version of the question for document retrieval | null>
}
Rules:
- "page" and "paragraph" must be integers, not strings
- "section" must be the exact identifier string (e.g. "II-A") — NOT the full section title
- When "isSpecific" is false, set "reformulatedQuery" to the most important keywords for retrieval
- Do not hallucinate; if unsure, return null for that field`;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query },
          ],
          max_tokens: 256,
          temperature: 0.0,
          top_p: 1,
        }),
      });

      if (!response.ok) throw new Error(`Kimi K2 error: ${response.status}`);

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || '{}';

      // Extraer JSON del output (puede venir envuelto en markdown)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Kimi K2 response');

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[QA] Kimi K2 intent:', parsed);

      return {
        page: typeof parsed.page === 'number' ? parsed.page : undefined,
        section: typeof parsed.section === 'string' ? parsed.section : undefined,
        paragraph: typeof parsed.paragraph === 'number' ? parsed.paragraph : undefined,
        isSpecific: parsed.isSpecific === true,
        reformulatedQuery: parsed.reformulatedQuery || undefined,
      };
    } catch (error: any) {
      console.warn('[QA] Kimi K2 intent fallback (usando solo RegEx):', error.message);
      return { isSpecific: false };
    }
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
   * Estrategias (en orden de preferencia):
   *  1. Separación por línea en blanco (\\n\\n)
   *  2. Separación por punto final + mayúscula siguiente
   *  3. Separación por \\n simple
   */
  private extractParagraphs(text: string): string[] {
    // Estrategia 1: línea en blanco
    let parts = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length >= 2) return parts;

    // Estrategia 2: oración completa (punto + espacio + mayúscula)
    parts = text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length >= 2) return parts;

    // Estrategia 3: salto de línea
    parts = text.split(/\n/).map(p => p.trim()).filter(p => p.length > 20);
    return parts.length >= 1 ? parts : [text];
  }

  /**
   * Obtiene contexto de PageIndex manejando múltiples constraints simultáneos.
   * Orden de prioridad: página → sección → párrafo → búsqueda general
   */
  private async getPageIndexByIntent(
    intent: { page?: number; section?: string; paragraph?: number; isSpecific: boolean },
    documentId: string,
    originalQuery?: string
  ): Promise<QAContext[]> {
    const contexts: QAContext[] = [];

    try {
      if (intent.isSpecific) {
        // Construir filtro de BD según los constraints disponibles
        const whereClause: any = { documentId };

        if (intent.page) {
          // Buscar el nodo exacto de esa página (isPageNode) o secciones que cubren esa página
          whereClause.OR = [
            { page: intent.page },
            // Nodo de sección cuyo rango de páginas incluye intent.page
            {
              AND: [
                { page: { lte: intent.page } },
                {
                  metadata: {
                    path: ['endPage'],
                    gte: intent.page,
                  },
                },
              ],
            },
          ];
        }

        if (intent.section) {
          // Añadir filtro de sección sobre lo que ya filtramos (título contiene)
          whereClause.title = { contains: intent.section, mode: 'insensitive' as const };
          delete whereClause.OR; // título + documentId es suficiente
        }

        const nodes = await prisma.pageIndex.findMany({
          where: whereClause,
          orderBy: [{ level: 'asc' }, { page: 'asc' }],
          take: 20,
        });

        // Si pedimos un párrafo específico, extraerlo del texto combinado
        if (intent.paragraph !== undefined && nodes.length > 0) {
          const fullText = nodes.map(n => n.content || '').join('\n\n');
          const paragraphs = this.extractParagraphs(fullText);
          const idx = intent.paragraph - 1;

          if (idx >= 0 && idx < paragraphs.length) {
            const refPage = nodes[0]?.page ?? intent.page;
            const refSection = intent.section
              ? nodes[0]?.title
              : `Párrafo ${intent.paragraph}${intent.page ? ` (pág. ${intent.page})` : ''}`;
            contexts.push({
              text: paragraphs[idx],
              page: refPage ?? undefined,
              section: refSection ?? undefined,
            });
          } else {
            // Párrafo fuera de rango: devolver el texto completo de la página/sección
            console.warn(`[QA] Párrafo ${intent.paragraph} no encontrado (solo hay ${paragraphs.length}), devolviendo contexto completo`);
            nodes.forEach(n => {
              if (n.content && n.content.length > 20) {
                contexts.push({
                  text: `${n.title}\n${n.content}`,
                  page: n.page ?? undefined,
                  section: n.title,
                });
              }
            });
          }
        } else {
          nodes.forEach(n => {
            if (n.content && n.content.length > 20) {
              contexts.push({
                text: `${n.title}\n${n.content}`,
                page: n.page ?? undefined,
                section: n.title,
              });
            }
          });
        }
      }

      // Si no hay resultado específico o la pregunta es general → LLM tree search
      if (contexts.length === 0) {
        if (originalQuery) {
          console.log(`[QA] Búsqueda general en PageIndex: "${originalQuery}"`);

          const [treeContexts, keywordContexts] = await Promise.all([
            this.getPageIndexByLLMTreeSearch(documentId, originalQuery),
            this.fallbackKeywordSearch(documentId, originalQuery),
          ]);

          // Combinar tree search + keyword search, deduplicando por section+page
          const seen = new Set<string>();
          for (const ctx of [...treeContexts, ...keywordContexts]) {
            const key = `${ctx.section ?? ''}|${ctx.page ?? ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              contexts.push(ctx);
            }
          }
          console.log(`[QA] Tree search: ${treeContexts.length} | Keyword: ${keywordContexts.length} | Total combinado: ${contexts.length}`);
        }

        // Fallback final
        if (contexts.length === 0) {
          console.log(`[QA] Fallback final: obteniendo primeras secciones`);
          const sections = await prisma.pageIndex.findMany({
            where: { documentId },
            orderBy: { level: 'asc' },
            take: 20,
          });
          sections.forEach(s => {
            if (s.content && s.content.length > 50) {
              contexts.push({
                text: `${s.title}\n${s.content}`,
                page: s.page ?? undefined,
                section: s.title,
              });
            }
          });
        }
      }
    } catch (error: any) {
      console.error('[QA] Error obteniendo contexto PageIndex:', error.message);
    }

    return contexts;
  }

  /**
   * Obtiene entidades relacionadas de FalkorDB
   */
  private async getRelatedEntities(
    documentId: string,
    contexts: QAContext[]
  ): Promise<any[]> {
    if (contexts.length === 0) return [];

    // Obtener páginas mencionadas en el contexto
    const pages = contexts.map(c => c.page).filter((p): p is number => typeof p === 'number');

    if (pages.length === 0) return [];

    try {
      // Buscar entidades en las páginas relevantes con $pages param para evitar interpolación
      const entitiesResult = await falkorDBService.roQuery(
        `MATCH (n)
         WHERE n.documentId = $docId
           AND n.page IN $pages
         RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.page AS page, n.section AS section
         LIMIT 50`,
        { docId: documentId, pages }
      );

      return entitiesResult.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.desc,
        page: r.page,
        section: r.section,
      }));
    } catch (error: any) {
      console.error('[QA] Error obteniendo entidades:', error.message);
      return [];
    }
  }

  /**
   * LLM Tree Search: envía árbol jerárquico compacto al LLM para identificar
   * los nodos relevantes, sin necesidad de buscar por keywords.
   */
  private async getPageIndexByLLMTreeSearch(
    documentId: string,
    query: string
  ): Promise<QAContext[]> {
    try {
      // 1. Obtener árbol compacto (sin content para reducir tokens)
      const nodes = await prisma.pageIndex.findMany({
        where: { documentId },
        select: {
          id: true,
          title: true,
          level: true,
          page: true,
          metadata: true,
        },
        orderBy: [{ level: 'asc' }, { page: 'asc' }],
        take: 300, // límite para no saturar el contexto del LLM
      });

      if (nodes.length === 0) return [];

      // 2. Serializar árbol compacto — excluir nodos "Página N" para reducir tokens
      //    (son nodos auxiliares de granularidad fina; las secciones detectadas son suficientes)
      const structureNodes = nodes.filter(n => {
        const meta = n.metadata as Record<string, unknown> | null;
        return meta?.isPageNode !== true;
      });
      // Si solo hay nodos de página (sin estructura), usarlos igualmente pero limitados
      const nodesToSerialize = structureNodes.length > 0 ? structureNodes : nodes.slice(0, 50);

      const treeText = nodesToSerialize
        .map(n => {
          const indent = '  '.repeat(Math.max(0, (n.level ?? 0) - 1));
          const meta = n.metadata as Record<string, unknown> | null;
          const summary = typeof meta?.summary === 'string' ? ` — ${meta.summary.slice(0, 120)}` : '';
          return `${indent}[${n.id}] L${n.level ?? 0} "${n.title}"${summary}${n.page ? ` (p.${n.page})` : ''}`;
        })
        .join('\n');

      // 3. Llamar al LLM para seleccionar nodos relevantes
      const systemPrompt = `You are a document index analyzer. Given a question and a section tree, output ONLY a JSON array of relevant section IDs.
Format: ["id1", "id2", ...]
Rules:
- Output ONLY the JSON array, nothing else
- Select ALL sections that are relevant to the question (up to 20)
- Include sections that partially cover the topic, not just the most obvious one
- If none are relevant, output: []
- Do NOT explain, do NOT add text before or after the array`;

      const prompt = `Document sections:\n${treeText}\n\nQuestion: ${query}\n\n["`;

      const rawResponse = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt,
        systemPrompt,
        maxTokens: 512,
        temperature: 0.0,
      });

      // 4. Parsear IDs — buscar array JSON en cualquier parte de la respuesta
      // El prompt termina con `["` para inducir al modelo a completar el array
      const fullText = '["' + rawResponse;
      const jsonMatch = fullText.match(/\[[\s\S]*?\]/) ?? rawResponse.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        console.log('[QA] LLM Tree Search: sin JSON en respuesta, usando keyword fallback');
        return [];
      }

      let nodeIds: string[];
      try {
        nodeIds = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
        // Filtrar solo strings que parezcan IDs de Prisma (cuid: 25 chars aprox)
        nodeIds = nodeIds.filter(id => typeof id === 'string' && id.length > 5);
      } catch {
        console.log('[QA] LLM Tree Search: JSON inválido, usando keyword fallback');
        return [];
      }

      // 5. Obtener contenido completo de los nodos seleccionados
      const selectedNodes = await prisma.pageIndex.findMany({
        where: { id: { in: nodeIds }, documentId },
        orderBy: { page: 'asc' },
      });

      return selectedNodes
        .filter(n => n.content && n.content.length > 20)
        .map(n => ({
          text: `${n.title}\n${n.content}`,
          page: n.page || undefined,
          section: n.title,
        }));
    } catch (error: any) {
      console.error('[QA] Error en LLM Tree Search:', error.message);
      return [];
    }
  }

  /**
   * Búsqueda por keywords como fallback cuando el LLM Tree Search no encuentra nada.
   */
  private async fallbackKeywordSearch(
    documentId: string,
    query: string
  ): Promise<QAContext[]> {
    try {
      // Extraer keywords (palabras de 4+ letras, excluyendo stopwords)
      const stopwords = new Set([
        'para', 'como', 'sobre', 'donde', 'cuando', 'cuál', 'cual',
        'qué', 'que', 'cómo', 'como', 'cuáles', 'cuales', 'este', 'esta',
        'estos', 'estas', 'quen', 'quién', 'quien', 'cuánto', 'cuanto',
        'dice', 'trata', 'habla', 'tiene', 'hay', 'está', 'esta',
      ]);

      const keywords = query
        .toLowerCase()
        .replace(/[¿?¡!.,;:()]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !stopwords.has(w));

      if (keywords.length === 0) return [];

      // 3. Buscar OR sobre titles y content
      const sections = await prisma.pageIndex.findMany({
        where: {
          documentId,
          OR: keywords.flatMap(kw => [
            { title: { contains: kw, mode: 'insensitive' as const } },
            { content: { contains: kw, mode: 'insensitive' as const } },
          ]),
        },
        orderBy: { page: 'asc' },
        take: 25,
      });

      return sections
        .filter(s => s.content && s.content.length > 50)
        .map(s => ({
          text: `${s.title}\n${s.content}`,
          page: s.page || undefined,
          section: s.title,
        }));
    } catch (error: any) {
      console.error('[QA] Error en keyword fallback:', error.message);
      return [];
    }
  }

  /**
   * Genera respuesta contextual con Qwen 3.5 122B (mejor razonamiento)
   */
  private async generateContextualAnswer(
    query: string,
    contexts: QAContext[],
    entities: any[],
    documentName: string,
  ): Promise<string> {
    const pageIndexText = contexts
      .map((c, i) => `### Sección ${i + 1}${c.page ? ` (Página ${c.page})` : ''}\n${c.text}`)
      .join('\n\n');

    const entitiesText = entities.length > 0
      ? '## Entidades identificadas:\n' +
        entities.map(e => `- ${e.type}: ${e.name}${e.description ? ` — ${e.description}` : ''}`).join('\n')
      : '';

    const fullContext = [pageIndexText, entitiesText].filter(Boolean).join('\n\n');

    if (!fullContext || fullContext.length < 50) {
      return 'No se encontró información suficiente en el documento para responder esta pregunta.';
    }

    // DeepSeek V4 Pro: 1M contexto permite incluir documentos completos sin truncar.
    // Modo no-thinking activado en nimService.generateWithDeepSeek().
    console.log(`[QA] DeepSeek V4 Pro: ${contexts.length} secciones, ${fullContext.length} chars`);

    try {
      return await nimService.generateWithDeepSeek({
        userPrompt: `Basándote ÚNICAMENTE en la siguiente información del documento "${documentName}", responde la pregunta de forma clara y completa.\n\nPREGUNTA: ${query}\n\n---\n\n${fullContext}`,
        systemPrompt: 'Eres un experto en auditoría ESG para la Secretaría de Economía de México. Responde en español, basándote ÚNICAMENTE en el contenido del documento proporcionado. Si la información no está en el documento, di explícitamente que no se encontró.',
        maxTokens: 4096,
        temperature: 0.2,
      });
    } catch (error: any) {
      console.error('[QA] Error con DeepSeek V4 Pro:', error.message);
      // Fallback a Llama 3.1
      try {
        return await nimService.generateText({
          model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
          prompt: `Documento: "${documentName}"\n\n${fullContext.slice(0, 28000)}\n\nPregunta: ${query}`,
          systemPrompt: 'Eres un experto en auditoría ESG. Responde basándote ÚNICAMENTE en el documento.',
          maxTokens: 2048,
          temperature: 0.3,
        });
      } catch (fallbackError: any) {
        return `Error al generar respuesta: ${fallbackError.message}`;
      }
    }
  }
}

export const qaService = new QAService();
