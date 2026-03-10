/**
 * Servicio de Q&A Mejorado que combina PageIndex + FalkorDB
 * 
 * Permite búsquedas específicas por:
 * - Página: "¿Qué hay en la página 4?"
 * - Sección: "¿De qué trata la sección II-A?"
 * - Contenido: "¿Qué dice sobre el sargazo?"
 * - Ubicación exacta: "¿Qué hay en el tercer párrafo de la página 5?"
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

    // 1. Extraer intención de la pregunta (página, sección, párrafo)
    const intent = this.extractQueryIntent(query);
    console.log(`[QA] Intención:`, intent);

    // 2. Obtener contexto de PageIndex basado en la intención
    const pageIndexContext = await this.getPageIndexByIntent(intent, documentId, query);

    // 3. Obtener entidades relacionadas de FalkorDB
    const entities = await this.getRelatedEntities(documentId, pageIndexContext);

    // 4. Generar respuesta contextual con LLM
    const answer = await this.generateContextualAnswer(query, pageIndexContext, entities, documentName);

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
   * Extrae la intención de búsqueda de la pregunta
   */
  private extractQueryIntent(query: string): {
    type: 'page' | 'section' | 'paragraph' | 'general';
    page?: number;
    section?: string;
    paragraph?: number;
    originalQuery: string;
  } {
    const lowerQuery = query.toLowerCase();

    // Patrón: "página X", "pagina X", "pág X", "pag X" - MEJORADO para detectar números
    const pageMatch = lowerQuery.match(/páginas?\s+(\d+)|paginas?\s+(\d+)|pág\.?\s*(\d+)|pag\.?\s*(\d+)|página\s+(\d+)|pagina\s+(\d+)/i);
    if (pageMatch) {
      const pageNum = pageMatch[1] || pageMatch[2] || pageMatch[3] || pageMatch[4] || pageMatch[5] || pageMatch[6];
      if (pageNum) {
        return {
          type: 'page',
          page: parseInt(pageNum),
          originalQuery: query,
        };
      }
    }

    // Patrón: "sección X", "seccion X", "capítulo X", "capitulo X"
    const sectionMatch = lowerQuery.match(/secc(?:ión|ion)?\s+([A-Z0-9.-]+)|cap(?:ítulo|itulo)?\s+([A-Z0-9.-]+)/i);
    if (sectionMatch && (sectionMatch[1] || sectionMatch[2])) {
      return {
        type: 'section',
        section: sectionMatch[1] || sectionMatch[2],
        originalQuery: query,
      };
    }

    // Patrón: "párrafo X", "parrafo X", "tercer párrafo", "cuarto párrafo", etc.
    const paragraphNumbers: Record<string, number> = {
      'primer': 1, 'primero': 1,
      'segundo': 2,
      'tercer': 3, 'tercero': 3,
      'cuarto': 4,
      'quinto': 5,
      'sexto': 6,
      'séptimo': 7, 'septimo': 7,
      'octavo': 8,
      'noveno': 9,
      'décimo': 10, 'decimo': 10,
    };

    // Buscar "párrafo [número]" o "[número] párrafo"
    const paragraphMatch = lowerQuery.match(/párrafo?s?\s+(\d+)|parrafo?s?\s+(\d+)|(\w+)\s+párrafo?s?\s+de/i);
    if (paragraphMatch) {
      const pageNum = paragraphMatch[1] || paragraphMatch[2];
      const wordNum = paragraphMatch[3];
      
      // Buscar también la página
      const pageInQuery = lowerQuery.match(/páginas?\s+(\d+)|paginas?\s+(\d+)|pág\.?\s*(\d+)|pag\.?\s*(\d+)/i);
      
      return {
        type: 'paragraph',
        page: pageInQuery && (pageInQuery[1] || pageInQuery[2]) ? parseInt(pageInQuery[1] || pageInQuery[2]) : undefined,
        paragraph: pageNum ? parseInt(pageNum) : (paragraphNumbers[wordNum] || 1),
        originalQuery: query,
      };
    }

    // Búsqueda general
    return {
      type: 'general',
      originalQuery: query,
    };
  }

  /**
   * Obtiene contexto de PageIndex basado en la intención
   */
  private async getPageIndexByIntent(
    intent: { type: string; page?: number; section?: string; paragraph?: number },
    documentId: string,
    originalQuery?: string  // ← Query original para búsqueda inteligente
  ): Promise<QAContext[]> {
    const contexts: QAContext[] = [];

    try {
      if (intent.type === 'page' && intent.page) {
        // Buscar todo el contenido de una página específica
        const sections = await prisma.pageIndex.findMany({
          where: { documentId, page: intent.page },
          orderBy: { level: 'asc' },
        });

        sections.forEach(s => {
          contexts.push({
            text: `${s.title}\n${s.content || ''}`,
            page: s.page || undefined,
            section: s.title,
          });
        });
      } else if (intent.type === 'section' && intent.section) {
        // Buscar sección específica por título
        const sections = await prisma.pageIndex.findMany({
          where: {
            documentId,
            title: { contains: intent.section, mode: 'insensitive' },
          },
          orderBy: { level: 'asc' },
        });

        sections.forEach(s => {
          contexts.push({
            text: `${s.title}\n${s.content || ''}`,
            page: s.page || undefined,
            section: s.title,
          });
        });
      } else if (intent.type === 'paragraph' && intent.page) {
        // Buscar página y extraer párrafo
        const sections = await prisma.pageIndex.findMany({
          where: { documentId, page: intent.page },
          orderBy: { level: 'asc' },
        });

        const fullText = sections.map(s => s.content || '').join('\n\n');
        const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

        if (intent.paragraph && paragraphs[intent.paragraph - 1]) {
          contexts.push({
            text: paragraphs[intent.paragraph - 1],
            page: intent.page,
            section: `Párrafo ${intent.paragraph}`,
          });
        }
      } else {
        // Búsqueda general: buscar términos de la pregunta en PageIndex
        if (originalQuery) {
          console.log(`[QA] Búsqueda general en PageIndex: "${originalQuery}"`);

          // Extraer términos clave (ignorar palabras comunes)
          const stopWords = ['de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'en', 'para', 'por', 'con', 'sobre', '?', '¿', 'y', 'es', 'son', 'me', 'mi', 'tu', 'te', 'lo', 'se'];
          const queryTerms = originalQuery
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));

          console.log(`[QA] Términos clave: ${queryTerms.join(', ')}`);

          if (queryTerms.length > 0) {
            // Construir condiciones de búsqueda OR
            const searchConditions = queryTerms.flatMap(term => [
              { title: { contains: term, mode: 'insensitive' as const } },
              { content: { contains: term, mode: 'insensitive' as const } },
            ]);

            let sections = await prisma.pageIndex.findMany({
              where: { documentId, OR: searchConditions },
              orderBy: { level: 'asc' },
              take: 50,
            });

            console.log(`[QA] Secciones encontradas (búsqueda principal): ${sections.length}`);

            // Si es referencia bíblica (ej: "60:9" o "60:9-22"), buscar específicamente
            const biblicalRefMatch = originalQuery.match(/(\d+):(\d+)(?:-(\d+))?/);
            if (biblicalRefMatch) {
              const chapter = biblicalRefMatch[1];
              const verseStart = biblicalRefMatch[2];
              const verseEnd = biblicalRefMatch[3] || verseStart;

              console.log(`[QA] Referencia bíblica detectada: capítulo ${chapter}, versículos ${verseStart}-${verseEnd}`);

              // Buscar contenido que tenga el patrón del capítulo y versículo
              const biblicalSections = await prisma.pageIndex.findMany({
                where: {
                  documentId,
                  content: {
                    contains: `${chapter}:${verseStart}`,
                    mode: 'insensitive',
                  },
                },
                orderBy: { page: 'asc' },
                take: 20,
              });

              console.log(`[QA] Secciones bíblicas encontradas: ${biblicalSections.length}`);

              // Combinar y eliminar duplicados
              const sectionIds = new Set(sections.map(s => s.id));
              biblicalSections.forEach(s => {
                if (!sectionIds.has(s.id)) {
                  sections.push(s);
                  sectionIds.add(s.id);
                }
              });

              console.log(`[QA] Total secciones combinadas: ${sections.length}`);
            }

            sections.forEach(s => {
              contexts.push({
                text: `${s.title}\n${s.content || ''}`,
                page: s.page || undefined,
                section: s.title,
              });
            });
          }
        }
        
        // Fallback: si no encontró nada, obtener primeras secciones
        if (contexts.length === 0) {
          console.log(`[QA] Fallback: obteniendo primeras secciones`);
          const sections = await prisma.pageIndex.findMany({
            where: { documentId },
            orderBy: { level: 'asc' },
            take: 20,
          });
          
          sections.forEach(s => {
            if (s.content && s.content.length > 50) {
              contexts.push({
                text: `${s.title}\n${s.content}`,
                page: s.page || undefined,
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
    const pages = contexts.map(c => c.page).filter(Boolean);

    if (pages.length === 0) return [];

    try {
      // Buscar entidades en las páginas relevantes
      const pagesClause = pages.map(p => `n.page = ${p}`).join(' OR ');
      const entitiesResult = await falkorDBService.query(`
        MATCH (n)
        WHERE n.documentId = "${documentId}"
          AND (${pagesClause})
        RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.page AS page, n.section AS section
        LIMIT 50
      `);

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
   * Detecta si la pregunta es sobre una referencia bíblica
   * Ejemplos: "ISAÍAS 60:9-22", "Juan 3:16", "Génesis 1:1"
   */
  private detectBiblicalReference(query: string): {
    book?: string;
    chapter?: number;
    verseStart?: number;
    verseEnd?: number;
    isBiblical: boolean;
  } | null {
    // Patrones bíblicos comunes en español
    const patterns = [
      // "ISAÍAS 60:9-22", "Isaías 60:9-22"
      /([a-zA-ZÁÉÍÓÚáéíóúñÑ]+)\s+(\d+):(\d+)(?:-(\d+))?/i,
      // "Isaías 60 versículo 9", "Isaías 60 versículos 9 al 22"
      /([a-zA-ZÁÉÍÓÚáéíóúñÑ]+)\s+(\d+)\s+versícul(?:o|os)?\s+(\d+)(?:\s+(?:al|hasta|a)\s+(\d+))?/i,
      // "Capítulo 60 de Isaías"
      /capítulo\s+(\d+)\s+de\s+([a-zA-ZÁÉÍÓÚáéíóúñÑ]+)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        let book: string | undefined;
        let chapter: number | undefined;
        let verseStart: number | undefined;
        let verseEnd: number | undefined;

        if (pattern.source.includes('capítulo')) {
          chapter = parseInt(match[1]);
          book = match[2];
        } else {
          book = match[1];
          chapter = parseInt(match[2]);
          verseStart = parseInt(match[3]);
          verseEnd = match[4] ? parseInt(match[4]) : verseStart;
        }

        return {
          book,
          chapter,
          verseStart,
          verseEnd,
          isBiblical: true,
        };
      }
    }

    return null;
  }

  /**
   * Busca texto bíblico específico en PageIndex
   */
  private async searchBiblicalText(
    documentId: string,
    book: string,
    chapter: number,
    verseStart?: number,
    verseEnd?: number
  ): Promise<QAContext[]> {
    try {
      const { prisma } = await import('./db');

      // Construir términos de búsqueda para el libro y capítulo
      const searchTerms = [
        `${book.toUpperCase()} ${chapter}`,
        `${book} ${chapter}`,
        `${book.toUpperCase()}\\s+${chapter}`,
      ];

      // Buscar en títulos y contenido
      const sections = await prisma.pageIndex.findMany({
        where: {
          documentId,
          OR: searchTerms.map(term => ({
            title: { contains: term, mode: 'insensitive' },
          })),
        },
        orderBy: { page: 'asc' },
        take: 20, // Máximo 20 secciones
      });

      if (sections.length === 0) {
        // Fallback: buscar por patrón de versículos
        const versePattern = verseStart 
          ? `${chapter}:${verseStart}`
          : `${chapter}:`;

        const verseSections = await prisma.pageIndex.findMany({
          where: {
            documentId,
            content: { contains: versePattern, mode: 'insensitive' },
          },
          orderBy: { page: 'asc' },
          take: 20,
        });

        return verseSections.map(s => ({
          text: s.content || '',
          page: s.page || undefined,
          section: s.title,
        }));
      }

      return sections.map(s => ({
        text: s.content || '',
        page: s.page || undefined,
        section: s.title,
      }));
    } catch (error: any) {
      console.error('[QA] Error buscando texto bíblico:', error.message);
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
    documentName: string
  ): Promise<string> {
    // Detectar referencia bíblica
    const biblicalRef = this.detectBiblicalReference(query);
    
    if (biblicalRef && biblicalRef.isBiblical) {
      console.log(`[QA] Referencia bíblica detectada: ${biblicalRef.book} ${biblicalRef.chapter}:${biblicalRef.verseStart || ''}-${biblicalRef.verseEnd || ''}`);
      
      // Si hay contexto pero es insuficiente, buscar más
      if (contexts.length === 0 || contexts.every(c => c.text.length < 100)) {
        const { prisma } = await import('./db');
        
        // Obtener documento para saber el documentId
        const doc = await prisma.document.findFirst({
          where: { name: { contains: documentName, mode: 'insensitive' } },
          select: { id: true },
        });
        
        if (doc?.id) {
          const biblicalContext = await this.searchBiblicalText(
            doc.id,
            biblicalRef.book || '',
            biblicalRef.chapter || 0,
            biblicalRef.verseStart,
            biblicalRef.verseEnd
          );
          
          if (biblicalContext.length > 0) {
            console.log(`[QA] Texto bíblico encontrado: ${biblicalContext.length} secciones`);
            contexts.push(...biblicalContext);
          }
        }
      }
    }

    const { qwenQAService } = await import('./qwen-qa');

    // Preparar contexto de PageIndex
    const pageIndexText = contexts
      .map((c, i) => `### Sección ${i + 1}${c.page ? ` (Página ${c.page})` : ''}\n${c.text}`)
      .join('\n\n');

    // Preparar entidades para Qwen
    const entitiesFormatted = entities.map(e => ({
      type: e.type,
      name: e.name,
      description: e.description,
      page: e.page,
    }));

    try {
      // Formatear relaciones para Qwen (si hay entidades)
      const relationsFormatted = entities.length > 0 
        ? entities.map((e: any) => ({
            source: e.name,
            type: 'RELATED',
            target: e.description || e.name,
          }))
        : [];
      
      console.log(`[QA] Enviando a Qwen: ${contexts.length} secciones, ${pageIndexText.length} chars`);
      
      // Usar Qwen 3.5 122B para mejor calidad de respuesta
      return await qwenQAService.generateAnswer({
        question: query,
        pageIndexContext: pageIndexText,
        entities: entitiesFormatted,
        relations: relationsFormatted,
        documentName,
      });
    } catch (error: any) {
      console.error('[QA] ❌ Error con Qwen:', error.message);
      console.log(`[QA] ✅ Contexto disponible: ${contexts.length} secciones`);
      console.log(`[QA] ✅ Primeras 3 secciones:`, contexts.slice(0, 3).map(c => c.section));
      
      // Fallback a NIM normal si Qwen falla - USANDO EL CONTEXTO DE PAGEINDEX
      const { nimService } = await import('./nim');
      
      // Construir contexto completo con TODA la información disponible
      const fullContext = [
        pageIndexText,  // ← Texto de PageIndex (30 secciones encontradas)
        entities.length > 0 ? '## Entidades:\n' + entities.map(e => `- ${e.type}: ${e.name}${e.description ? ` (${e.description})` : ''}`).join('\n') : '',
      ].filter(Boolean).join('\n\n');
      
      console.log(`[QA] 📤 Enviando ${fullContext.length} chars de contexto a Llama 3.1`);
      console.log(`[QA] 📄 Contexto incluye ${contexts.length} secciones de PageIndex`);
      
      if (!fullContext || fullContext.length < 50) {
        console.warn('[QA] ⚠️ Contexto insuficiente (< 50 chars)');
        return 'No se encontró información suficiente en el documento para responder esta pregunta.';
      }

      try {
        const response = await nimService.generateText({
          model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
          prompt: `Basándote ÚNICAMENTE en esta información del documento "${documentName}":\n\n${fullContext}\n\nResponde la pregunta: ${query}\n\nSi la pregunta es sobre una referencia bíblica específica (como ISAÍAS 60:9-22), busca en el texto proporcionado y cita los versículos exactos si están disponibles.`,
          systemPrompt: 'Eres un asistente experto en análisis de documentos bíblicos. Responde basándote ÚNICAMENTE en la información proporcionada. Si encuentras la referencia bíblica específica, cita el texto exacto.',
          maxTokens: 2048,
          temperature: 0.3,
        });
        
        console.log(`[QA] ✅ Respuesta generada: ${response.length} chars`);
        return response;
      } catch (fallbackError: any) {
        console.error('[QA] ❌ Error en fallback Llama 3.1:', fallbackError.message);
        return `Error al generar respuesta: ${fallbackError.message}`;
      }
    }
  }
}

export const qaService = new QAService();
