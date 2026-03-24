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

    // 1. Extraer intención de la pregunta (página, sección, párrafo — no exclusivo)
    const intent = this.extractQueryIntent(query);
    console.log(`[QA] Intención:`, { page: intent.page, section: intent.section, paragraph: intent.paragraph, isSpecific: intent.isSpecific });

    // 2. Obtener contexto de PageIndex basado en la intención
    const pageIndexContext = await this.getPageIndexByIntent(intent, documentId, query);

    // 3. Obtener entidades relacionadas de FalkorDB
    const entities = await this.getRelatedEntities(documentId, pageIndexContext);

    // 4. Generar respuesta contextual con LLM
    const answer = await this.generateContextualAnswer(query, pageIndexContext, entities, documentName, documentId);

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
    const pages = contexts.map(c => c.page).filter(Boolean);

    if (pages.length === 0) return [];

    try {
      // Buscar entidades en las páginas relevantes usando IN para mejor rendimiento
      const pagesIN = pages.join(', ');
      const entitiesResult = await falkorDBService.roQuery(`
        MATCH (n)
        WHERE n.documentId = "${documentId}"
          AND n.page IN [${pagesIN}]
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
    // Lista de libros bíblicos conocidos para evitar falsos positivos (ej. "ISO 9001:2015")
    const biblicalBooks = new Set([
      'génesis', 'genesis', 'éxodo', 'exodo', 'levítico', 'levitico', 'números', 'numeros',
      'deuteronomio', 'josué', 'josue', 'jueces', 'rut', 'ruth', 'samuel', 'reyes',
      'crónicas', 'cronicas', 'esdras', 'nehemías', 'nehemias', 'ester', 'esther',
      'job', 'salmos', 'proverbios', 'eclesiastés', 'eclesiastes', 'cantares',
      'isaías', 'isaias', 'jeremías', 'jeremias', 'lamentaciones', 'ezequiel',
      'daniel', 'oseas', 'joel', 'amós', 'amos', 'abdías', 'abdias', 'jonás', 'jonas',
      'miqueas', 'nahúm', 'nahum', 'habacuc', 'sofonías', 'sofonias', 'hageo',
      'zacarías', 'zacarias', 'malaquías', 'malaquias',
      'mateo', 'marcos', 'lucas', 'juan', 'hechos', 'romanos', 'corintios',
      'gálatas', 'galatas', 'efesios', 'filipenses', 'colosenses', 'tesalonicenses',
      'timoteo', 'tito', 'filemón', 'filemon', 'hebreos', 'santiago', 'pedro',
      'judas', 'apocalipsis',
    ]);

    // Patrones bíblicos comunes en español
    const patterns = [
      // "ISAÍAS 60:9-22", "Isaías 60:9-22" — solo números de versículo razonables (1-200)
      /([a-zA-ZÁÉÍÓÚáéíóúñÑ]+)\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?/i,
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
          verseStart = match[3] ? parseInt(match[3]) : undefined;
          verseEnd = match[4] ? parseInt(match[4]) : verseStart;
        }

        // Validar que el libro es realmente un libro bíblico conocido
        // para evitar falsos positivos como "ISO 9001:2015" o "versión 2:3"
        if (book && !biblicalBooks.has(book.toLowerCase())) {
          continue;
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
   * Incluye detección de referencias bíblicas.
   */
  private async fallbackKeywordSearch(
    documentId: string,
    query: string
  ): Promise<QAContext[]> {
    try {
      // 1. Verificar si es referencia bíblica
      const biblicalRef = this.detectBiblicalReference(query);
      if (biblicalRef?.isBiblical && biblicalRef.book && biblicalRef.chapter) {
        console.log(`[QA] Keyword fallback: referencia bíblica detectada`);
        const biblicalResults = await this.searchBiblicalText(
          documentId,
          biblicalRef.book,
          biblicalRef.chapter,
          biblicalRef.verseStart,
          biblicalRef.verseEnd
        );
        if (biblicalResults.length > 0) return biblicalResults;
      }

      // 2. Extraer keywords (palabras de 4+ letras, excluyendo stopwords)
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
    documentId: string
  ): Promise<string> {
    // Detectar referencia bíblica — solo si el contexto aún está vacío o insuficiente
    // (si ya vino de fallbackKeywordSearch, el contexto bíblico ya está incluido)
    if (contexts.length === 0 || contexts.every(c => c.text.length < 100)) {
      const biblicalRef = this.detectBiblicalReference(query);
      if (biblicalRef?.isBiblical && biblicalRef.book && biblicalRef.chapter) {
        console.log(`[QA] Referencia bíblica detectada: ${biblicalRef.book} ${biblicalRef.chapter}:${biblicalRef.verseStart || ''}-${biblicalRef.verseEnd || ''}`);
        const biblicalContext = await this.searchBiblicalText(
          documentId,
          biblicalRef.book,
          biblicalRef.chapter,
          biblicalRef.verseStart,
          biblicalRef.verseEnd
        );
        if (biblicalContext.length > 0) {
          console.log(`[QA] Texto bíblico encontrado: ${biblicalContext.length} secciones`);
          contexts.push(...biblicalContext);
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
