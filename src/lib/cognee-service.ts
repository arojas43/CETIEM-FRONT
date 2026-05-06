/**
 * Servicio Cognee mejorado para extracción de conocimiento con grafos individuales
 * Integración: PageIndex + Cognee + FalkorDB
 *
 * Cada documento tiene SU PROPIO grafo de conocimiento aislado
 * Soporta múltiples dominios: médico, empresarial/legal, técnico, académico
 */

import { falkorDBService } from './falkordb';
import { nimService } from './nim';
import { prisma } from './db';

/**
 * Extrae el primer objeto JSON válido de un string de texto libre.
 * Más robusto que un regex greedy: usa conteo de llaves balanceadas.
 */
function extractFirstJSON(text: string): any | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export type CogneeDomain = 'industria' | 'construccion' | 'tecnologia';
export type ExtractionMode = 'auto' | 'directed' | 'mixed';

export interface ExtractionConfig {
  mode: ExtractionMode;
  /** Temas específicos en los que enfocarse, ej: "diagnóstico de piel, rituales de pureza" */
  focusTopics?: string;
  /** Tipos de entidad personalizados, uno por línea: "RITUAL: Ritual o ceremonia religiosa" */
  customEntityTypes?: string;
  /** Tipos de relación personalizados, uno por línea: "PURIFIES: Purifica a persona" */
  customRelationTypes?: string;
  /** Instrucciones adicionales libres para el LLM */
  instructions?: string;
}

export interface CogneeEntity {
  id: string;
  type: string;
  name: string;
  description?: string;
  properties?: Record<string, any>;
}

export interface CogneeRelation {
  id: string;
  source: string; // entity ID
  target: string; // entity ID
  type: string;
  properties?: Record<string, any>;
}

export interface CogneeSearchResult {
  answer: string;
  entities: CogneeEntity[];
  relations: CogneeRelation[];
  context: string;
  sources: {
    section?: string;
    page?: number;
    documentId?: string;
  }[];
}

/**
 * Configuración de prompts por dominio
 */
const DOMAIN_CONFIGS: Record<CogneeDomain, {
  entityTypes: string[];
  relationTypes: string[];
  systemPrompt: string;
  exampleOutput: string;
}> = {
  industria: {
    entityTypes: [
      'ORGANIZATION: Empresas, plantas industriales, proveedores, contratistas',
      'REGULATION: Normas ISO (9001, 14001, 45001), NOMs, reglamentos aplicables',
      'REQUIREMENT: Requisitos legales, obligaciones de SST, medio ambiente, calidad',
      'PROCESS: Procesos productivos, operaciones industriales, procedimientos',
      'HAZARD: Peligros, riesgos, agentes contaminantes, sustancias peligrosas',
      'INDICATOR: KPIs, métricas ESG, indicadores de desempeño ambiental/social',
      'PERSON: Responsables, representantes, cargo/puesto',
      'DOCUMENT: Políticas, manuales, registros, certificados, permisos',
    ],
    relationTypes: [
      'COMPLIES_WITH: Cumple con norma/regulación',
      'IMPLEMENTS: Implementa procedimiento/requisito',
      'GENERATES: Genera residuo/emisión/contaminante',
      'MITIGATES: Mitiga riesgo/impacto ambiental',
      'RESPONSIBLE_FOR: Responsable de proceso/área',
      'CERTIFIED_BY: Certificado por organismo/norma',
      'MEASURES: Mide indicador/métrica',
      'AFFECTS: Afecta a parte interesada/comunidad',
    ],
    systemPrompt: 'Eres un experto en auditoría ESG para empresas industriales. Identifica organizaciones, normas (ISO 9001/14001/45001), requisitos de SST, procesos productivos, peligros y métricas de desempeño ambiental y social.',
    exampleOutput: `{"entities": [{"id": "1", "type": "ORGANIZATION", "name": "Planta Monterrey", "description": "Planta de manufactura principal"}, {"id": "2", "type": "REGULATION", "name": "ISO 14001:2015", "description": "Sistema de gestión ambiental"}, {"id": "3", "type": "INDICATOR", "name": "Consumo de agua m³/ton", "description": "KPI hídrico de producción"}], "relations": [{"source": "1", "target": "2", "type": "COMPLIES_WITH"}, {"source": "1", "target": "3", "type": "MEASURES"}]}`,
  },
  construccion: {
    entityTypes: [
      'ORGANIZATION: Constructoras, contratistas, supervisores, clientes',
      'PROJECT: Obras, proyectos, contratos de construcción',
      'REGULATION: NOM-031, Reglamento de construcción, licencias, permisos',
      'MATERIAL: Materiales de construcción, insumos, residuos de obra',
      'HAZARD: Riesgos de obra, peligros en altura, caídas, derrumbes',
      'WORKER: Personal de obra, cuadrillas, subcontratistas',
      'INDICATOR: Indicadores de accidentabilidad, residuos, emisiones de polvo',
      'DOCUMENT: Bitácoras, planos, permisos, planes de seguridad',
    ],
    relationTypes: [
      'EXECUTES: Ejecuta proyecto/obra',
      'REQUIRES_PERMIT: Requiere permiso/licencia',
      'GENERATES_WASTE: Genera residuo de construcción',
      'EXPOSES_TO: Expone a trabajador a peligro',
      'COMPLIES_WITH: Cumple con norma/reglamento',
      'SUPERVISES: Supervisa trabajo/contratista',
      'LOCATED_IN: Ubicado en sitio/municipio',
      'MITIGATES: Mitiga impacto ambiental/social',
    ],
    systemPrompt: 'Eres un experto en auditoría ESG para empresas de construcción. Identifica obras, contratistas, normativa de seguridad en obra (NOM-031), materiales, residuos de construcción y demolición, riesgos laborales e indicadores ambientales.',
    exampleOutput: `{"entities": [{"id": "1", "type": "PROJECT", "name": "Torre Corporativa CDMX", "description": "Edificio de 30 pisos en construcción"}, {"id": "2", "type": "REGULATION", "name": "NOM-031-STPS-2011", "description": "Seguridad en obras de construcción"}, {"id": "3", "type": "HAZARD", "name": "Trabajo en altura", "description": "Riesgo de caída mayor a 1.8m"}], "relations": [{"source": "1", "target": "2", "type": "COMPLIES_WITH"}, {"source": "1", "target": "3", "type": "EXPOSES_TO"}]}`,
  },
  tecnologia: {
    entityTypes: [
      'ORGANIZATION: Empresas tech, proveedores cloud, clientes, socios',
      'SYSTEM: Sistemas de información, plataformas, infraestructura digital',
      'DATA: Datos personales, activos de información, bases de datos',
      'REGULATION: LGPDPPSO, ISO 27001, SOC 2, leyes de ciberseguridad',
      'RISK: Riesgos digitales, vulnerabilidades, amenazas cibernéticas',
      'INDICATOR: KPIs ESG digital, consumo energético TI, diversidad de plantilla',
      'PERSON: Responsables de datos, CISO, DPO, stakeholders',
      'DOCUMENT: Políticas de privacidad, contratos, reportes de incidentes',
    ],
    relationTypes: [
      'PROCESSES: Procesa datos personales',
      'COMPLIES_WITH: Cumple con norma/ley de datos',
      'EXPOSES_TO: Expone a riesgo/vulnerabilidad',
      'MITIGATES: Mitiga riesgo cibernético',
      'RESPONSIBLE_FOR: Responsable de datos/sistema',
      'INTEGRATES_WITH: Integra con sistema/API',
      'MEASURES: Mide indicador/métrica ESG',
      'ISSUED_BY: Emitido por organismo regulador',
    ],
    systemPrompt: 'Eres un experto en auditoría ESG para empresas de tecnología y servicios digitales. Identifica sistemas de información, datos personales, cumplimiento LGPDPPSO/ISO 27001, riesgos cibernéticos, consumo energético de TI y métricas de gobierno corporativo digital.',
    exampleOutput: `{"entities": [{"id": "1", "type": "ORGANIZATION", "name": "SaaS Corp México", "description": "Empresa de software B2B"}, {"id": "2", "type": "REGULATION", "name": "LGPDPPSO", "description": "Ley general de protección de datos"}, {"id": "3", "type": "INDICATOR", "name": "PUE del datacenter", "description": "Power Usage Effectiveness — eficiencia energética"}], "relations": [{"source": "1", "target": "2", "type": "COMPLIES_WITH"}, {"source": "1", "target": "3", "type": "MEASURES"}]}`,
  },
};

export class CogneeService {
  private defaultDomain: CogneeDomain = 'industria';

  /**
   * Extrae conocimiento de un chunk individual.
   * Para procesamiento masivo usar `batchExtractKnowledge` (DeepSeek V4 Pro, 1M ctx).
   */
  async extractKnowledge(
    content: string,
    documentId: string,
    documentName: string,
    domain?: CogneeDomain,
    pageIndexReference?: {
      page?: number;
      section?: string;
      start_index?: number;
      end_index?: number;
    },
    extractionConfig?: ExtractionConfig,
    companyId?: string
  ): Promise<{ entities: CogneeEntity[]; relations: CogneeRelation[] }> {
    const selectedDomain = domain || this.defaultDomain;
    const prompt = this.buildDomainPrompt(content, documentName, selectedDomain, extractionConfig);

    try {
      const config = DOMAIN_CONFIGS[selectedDomain];
      const response = await nimService.generateWithDeepSeek({
        userPrompt: prompt,
        systemPrompt: config.systemPrompt,
        maxTokens: 4096,
        temperature: 0.1,
      });
      return this.parseKnowledgeGraph(response, documentId, pageIndexReference, companyId);
    } catch (error: any) {
      console.error('[Cognee] Error extrayendo conocimiento:', error.message);
      return { entities: [], relations: [] };
    }
  }

  /**
   * Extrae entidades/relaciones de un batch de chunks en UNA SOLA llamada a DeepSeek V4 Pro.
   * Con 1M de contexto puede procesar 20-50 chunks simultáneamente, reduciendo las
   * llamadas a la API de N a ceil(N/batchSize).
   *
   * @returns Array parallel a `chunks`; cada posición contiene las entidades/relaciones
   *          del chunk correspondiente.
   */
  async batchExtractKnowledge(
    chunks: Array<{
      content: string;
      title: string;
      page?: number;
      id: string;
    }>,
    documentId: string,
    documentName: string,
    domain: CogneeDomain,
    companyId?: string
  ): Promise<Array<{ entities: CogneeEntity[]; relations: CogneeRelation[] }>> {
    if (chunks.length === 0) return [];

    const config = DOMAIN_CONFIGS[domain];

    const chunksText = chunks
      .map((c, i) =>
        `### FRAGMENTO ${i + 1} (id: ${c.id}${c.page ? `, página: ${c.page}` : ''}, sección: "${c.title}")\n${c.content.slice(0, 12000)}`
      )
      .join('\n\n---\n\n');

    const prompt = `Analiza los siguientes ${chunks.length} fragmentos del documento "${documentName}" y extrae entidades y relaciones de CADA fragmento.

## TIPOS DE ENTIDAD VÁLIDOS:
${config.entityTypes.map(t => `- ${t}`).join('\n')}

## TIPOS DE RELACIÓN VÁLIDOS:
${config.relationTypes.map(t => `- ${t}`).join('\n')}

## FORMATO DE SALIDA (JSON estricto, sin texto adicional):
[
  {
    "chunk_index": 0,
    "entities": [{"id": "1", "type": "ORGANIZATION", "name": "...", "description": "..."}],
    "relations": [{"source": "1", "target": "2", "type": "COMPLIES_WITH"}]
  },
  ...
]
El array debe tener exactamente ${chunks.length} objetos (uno por fragmento), en el mismo orden.

## FRAGMENTOS:

${chunksText}`;

    try {
      const response = await nimService.generateWithDeepSeek({
        userPrompt: prompt,
        systemPrompt: config.systemPrompt,
        maxTokens: Math.min(8192, chunks.length * 400 + 512),
        temperature: 0.1,
      });

      const parsed = extractFirstJSON(response);
      if (!Array.isArray(parsed)) {
        console.warn('[Cognee] batchExtract: respuesta no es array, usando fallback individual');
        return chunks.map(() => ({ entities: [], relations: [] }));
      }

      return chunks.map((chunk, i) => {
        const item = parsed[i] ?? {};
        const rawEntities: any[] = Array.isArray(item.entities) ? item.entities : [];
        const rawRelations: any[] = Array.isArray(item.relations) ? item.relations : [];

        const entityIdMap = new Map<string, string>();
        const entities: CogneeEntity[] = rawEntities.map((e: any) => {
          const uid = `${documentId}-${chunk.id}-${e.id || Math.random().toString(36).slice(2)}`;
          entityIdMap.set(String(e.id), uid);
          return {
            id: uid,
            type: String(e.type || 'ENTITY').toUpperCase(),
            name: String(e.name || ''),
            description: e.description ? String(e.description) : undefined,
            properties: {
              page: chunk.page,
              section: chunk.title,
              documentId,
              ...(companyId ? { companyId } : {}),
            },
          };
        });

        const relations: CogneeRelation[] = rawRelations
          .map((r: any) => {
            const src = entityIdMap.get(String(r.source));
            const tgt = entityIdMap.get(String(r.target));
            if (!src || !tgt) return null;
            return {
              id: `${src}-${r.type}-${tgt}`,
              source: src,
              target: tgt,
              type: String(r.type || 'RELATED').toUpperCase(),
            };
          })
          .filter((r): r is CogneeRelation => r !== null);

        return { entities, relations };
      });
    } catch (error: any) {
      console.error('[Cognee] batchExtract error:', error.message);
      return chunks.map(() => ({ entities: [], relations: [] }));
    }
  }

  /**
   * Construye prompt específico por dominio
   */
  private buildDomainPrompt(
    content: string,
    documentName: string,
    domain: CogneeDomain,
    extractionConfig?: ExtractionConfig
  ): string {
    const config = DOMAIN_CONFIGS[domain];
    const mode = extractionConfig?.mode ?? 'auto';

    // Construir lista de tipos de entidad según el modo
    let entityTypes: string[];
    let relationTypes: string[];

    const customEntities = extractionConfig?.customEntityTypes
      ?.split('\n').map(l => l.trim()).filter(Boolean) ?? [];
    const customRelations = extractionConfig?.customRelationTypes
      ?.split('\n').map(l => l.trim()).filter(Boolean) ?? [];

    if (mode === 'directed') {
      // Solo usar los tipos definidos por el usuario
      entityTypes = customEntities.length > 0 ? customEntities : config.entityTypes;
      relationTypes = customRelations.length > 0 ? customRelations : config.relationTypes;
    } else if (mode === 'mixed') {
      // Combinar dominio + tipos del usuario
      entityTypes = [...config.entityTypes, ...customEntities];
      relationTypes = [...config.relationTypes, ...customRelations];
    } else {
      // auto: solo dominio
      entityTypes = config.entityTypes;
      relationTypes = config.relationTypes;
    }

    // Sección de foco temático (directed / mixed)
    const focusSection = extractionConfig?.focusTopics
      ? `\n## ENFOQUE TEMÁTICO:\nPresta especial atención a los siguientes temas: ${extractionConfig.focusTopics}\n`
      : '';

    // Instrucciones adicionales libres
    const extraInstructions = extractionConfig?.instructions
      ? `\n## INSTRUCCIONES ADICIONALES:\n${extractionConfig.instructions}\n`
      : '';

    const modeLabel = mode === 'directed'
      ? 'DIRIGIDO (extrae solo lo especificado)'
      : mode === 'mixed'
        ? 'MIXTO (dominio + tipos personalizados)'
        : 'AUTOMÁTICO';

    return `Analiza el siguiente fragmento de documento y extrae TODAS las entidades y relaciones importantes.

Documento: ${documentName}
Dominio: ${domain.toUpperCase()} — Modo: ${modeLabel}
${focusSection}${extraInstructions}
## INSTRUCCIONES:
1. Identifica entidades de los tipos listados
2. Identifica TODAS las relaciones entre entidades encontradas
3. Asigna IDs simples: "1", "2", "3"...
4. Responde ÚNICAMENTE con JSON válido, sin texto adicional

## FORMATO DE SALIDA:
${config.exampleOutput}

## TIPOS DE ENTIDAD VÁLIDOS:
${entityTypes.map(t => `- ${t}`).join('\n')}

## TIPOS DE RELACIÓN VÁLIDOS:
${relationTypes.map(t => `- ${t}`).join('\n')}

## FRAGMENTO A ANALIZAR:
${content.slice(0, 15000)}`;
  }

  /**
   * Guarda entidades y relaciones en el grafo INDIVIDUAL del documento
   * Cada documento tiene su propio grafo aislado por documentId
   */
  async persistToGraph(
    entities: CogneeEntity[],
    relations: CogneeRelation[],
    documentId: string,
    companyId?: string
  ): Promise<{ saved: number; failed: number; relationsSaved: number }> {
    let saved = 0;
    let failed = 0;
    let relationsSaved = 0;

    // Guardar entidades en batch agrupado por tipo (UNWIND)
    if (entities.length > 0) {
      try {
        const batchInput = entities.map(entity => ({
          label: entity.type,
          properties: {
            id: entity.id,
            name: entity.name,
            documentId,
            ...(companyId ? { companyId } : {}),
            ...(entity.description ? { description: entity.description } : {}),
            ...(entity.properties ? entity.properties : {}),
          },
        }));
        const created = await falkorDBService.createEntitiesBatch(batchInput);
        saved += created;
        failed += entities.length - created;

        // Enriquecer nodos con embeddings para búsqueda semántica (HNSW)
        try {
          const texts = entities.map(e =>
            `${e.type}: ${e.name}${e.description ? ` — ${e.description.slice(0, 200)}` : ''}`
          );
          const embeddings = await nimService.generateEmbeddings(texts);
          const embeddingItems = entities.map((e, i) => ({ id: e.id, embedding: embeddings[i] }));
          await falkorDBService.setEntityEmbeddings(embeddingItems);
        } catch (embErr: any) {
          // Non-critical: grafo funciona sin embeddings, solo pierde búsqueda vectorial
          console.warn('[Cognee] No se generaron embeddings para entidades:', embErr.message);
        }
      } catch (error: any) {
        console.error('[Cognee] Error en batch de entidades:', error.message);
        failed += entities.length;
      }
    }

    // Guardar relaciones (requieren MATCH → siguen siendo individuales)
    for (const relation of relations) {
      try {
        await falkorDBService.createRelation(
          relation.source,
          relation.target,
          relation.type,
          relation.properties
        );
        relationsSaved++;
      } catch {
        // Relation may reference entities that failed to save — non-fatal
      }
    }

    return { saved, failed, relationsSaved };
  }

  /**
   * Búsqueda semántica en el grafo INDIVIDUAL de un documento
   * Combina búsqueda en grafo + contexto de PageIndex
   */
  async search(
    query: string,
    documentId: string,
    options?: {
      limit?: number;
      includeRelations?: boolean;
      page?: number;        // Búsqueda por página específica
      section?: string;     // Búsqueda por sección específica
      domain?: CogneeDomain; // Dominio para fallback de tipos
      companyId?: string;   // Defense-in-depth: filtro multi-tenant adicional
    }
  ): Promise<CogneeSearchResult> {
    const limit = options?.limit || 20;
    const includeRelations = options?.includeRelations !== false;
    const domain = options?.domain || this.defaultDomain;
    const companyId = options?.companyId;

    // Validar dominio — evitar throw si llega valor inesperado
    const safeDomain: CogneeDomain = domain in DOMAIN_CONFIGS ? domain : 'industria';

    // 1a. Búsqueda semántica vectorial (FalkorDB 4.0+ HNSW) — alta precisión
    let entities: CogneeEntity[] = [];
    try {
      const queryEmbedding = await nimService.generateEmbedding(query);
      const vectorHits = await falkorDBService.vectorSearch('ENTITY', queryEmbedding, limit, documentId, companyId);
      // También buscar en tipos específicos del dominio
      const domainLabels = (DOMAIN_CONFIGS[safeDomain]?.entityTypes ?? [])
        .map(t => t.split(':')[0].trim()).slice(0, 3); // top 3 labels del dominio
      for (const label of domainLabels) {
        const hits = await falkorDBService.vectorSearch(label, queryEmbedding, Math.ceil(limit / 2), documentId, companyId);
        vectorHits.push(...hits);
      }
      // Deduplicar por nombre + ordenar por score
      const seen = new Set<string>();
      entities = vectorHits
        .sort((a, b) => b.score - a.score)
        .filter(h => { const k = h.name?.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, limit)
        .map((h, i) => ({ id: `vec-${i}`, type: h.type, name: h.name, description: h.description }));
    } catch {
      // Vector search no disponible — fallback a CONTAINS
    }

    // FalkorDB doesn't support parametrized LIMIT — validate and interpolate
    const safeLim = Math.min(1000, Math.max(1, Math.floor(limit)));

    // 1b. Fallback: búsqueda textual case-insensitive
    if (entities.length === 0) {
      const params1b: Record<string, any> = { docId: documentId, q: query };
      const cFilter1b = companyId ? 'AND n.companyId = $cid ' : '';
      if (companyId) params1b.cid = companyId;
      const entitiesResult = await falkorDBService.roQuery(
        `MATCH (n)
         WHERE n.documentId = $docId ${cFilter1b}
           AND (toLower(n.name) CONTAINS toLower($q) OR toLower(n.description) CONTAINS toLower($q))
         RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.id AS id
         LIMIT ${safeLim}`,
        params1b
      );
      entities = entitiesResult.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.desc,
      }));
    }

    // 2. Si aún no encuentra, buscar por tipos del dominio (sin filtro de texto)
    if (entities.length === 0) {
      const domainEntityTypes = (DOMAIN_CONFIGS[safeDomain]?.entityTypes ?? [])
        .map(t => t.split(':')[0].trim());

      const params2: Record<string, any> = { docId: documentId, types: domainEntityTypes };
      const cFilter2 = companyId ? 'AND n.companyId = $cid ' : '';
      if (companyId) params2.cid = companyId;
      const typeSearch = await falkorDBService.roQuery(
        `MATCH (n)
         WHERE n.documentId = $docId ${cFilter2}
           AND labels(n)[0] IN $types
         RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.id AS id
         LIMIT ${safeLim}`,
        params2
      );

      entities = typeSearch.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.desc,
      }));
    }

    // 3. Obtener relaciones si se solicita
    // Use entity names for the match — vector search entities have synthetic IDs (vec-N)
    // that don't correspond to graph node IDs, so matching by name is the only robust approach.
    let relations: CogneeRelation[] = [];
    if (includeRelations && entities.length > 0) {
      const entityNames = entities.map(e => e.name).filter(Boolean);
      const relParams: Record<string, any> = { docId: documentId, names: entityNames };
      const cFilterRel = companyId ? 'AND a.companyId = $cid AND b.companyId = $cid ' : '';
      if (companyId) relParams.cid = companyId;
      const relationsResult = await falkorDBService.roQuery(
        `MATCH (a)-[r]->(b)
         WHERE a.documentId = $docId AND b.documentId = $docId ${cFilterRel}
           AND a.name IN $names
         RETURN a.name AS source, type(r) AS type, b.name AS target
         LIMIT 50`,
        relParams
      );

      relations = relationsResult.rows.map(r => ({
        id: `rel-${r.source}-${r.target}`,
        source: r.source,
        target: r.target,
        type: r.type,
      }));
    }

    // 4. Obtener contexto de PageIndex
    const context = await this.getPageIndexContext(documentId, query);

    // 5. Generar respuesta con LLM usando el dominio correcto
    const answer = await this.generateAnswer(query, entities, relations, context, domain);

    return {
      answer,
      entities,
      relations,
      context,
      sources: entities.map(_e => ({
        documentId,
      })),
    };
  }

  /**
   * Obtiene contexto de PageIndex para una búsqueda
   */
  private async getPageIndexContext(documentId: string, query: string): Promise<string> {
    try {
      // Buscar secciones relevantes
      const sections = await prisma.pageIndex.findMany({
        where: {
          documentId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          title: true,
          content: true,
          page: true,
          level: true,
        },
        take: 5,
      });

      if (sections.length === 0) {
        return '';
      }

      return sections.map(s =>
        `## ${s.title}${s.page ? ` (pág. ${s.page})` : ''}\n${s.content?.slice(0, 500) || ''}`
      ).join('\n\n');
    } catch (error: any) {
      console.error('[Cognee] Error obteniendo contexto PageIndex:', error.message);
      return '';
    }
  }

  /**
   * Genera respuesta usando LLM con contexto del grafo
   */
  private async generateAnswer(
    query: string,
    entities: CogneeEntity[],
    relations: CogneeRelation[],
    context: string,
    domain?: CogneeDomain
  ): Promise<string> {
    const entitiesText = entities.length > 0
      ? 'Entidades encontradas:\n' + entities.map(e => `- ${e.type}: ${e.name}${e.description ? ` (${e.description})` : ''}`).join('\n')
      : '';

    const relationsText = relations.length > 0
      ? 'Relaciones:\n' + relations.map(r => `- ${r.source} → ${r.type} → ${r.target}`).join('\n')
      : '';

    const contextText = context
      ? `Contexto del documento:\n${context.slice(0, 2000)}`
      : '';

    const fullContext = [entitiesText, relationsText, contextText].filter(Boolean).join('\n\n');

    if (!fullContext) {
      return 'No se encontró información relevante sobre esta consulta en el documento.';
    }

    const selectedDomain = domain || this.defaultDomain;
    const domainSystemPrompt = DOMAIN_CONFIGS[selectedDomain].systemPrompt;

    try {
      const answer = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt: `Basándote ÚNICAMENTE en esta información:\n\n${fullContext}\n\nResponde la pregunta: ${query}`,
        systemPrompt: `${domainSystemPrompt} Responde basándote ÚNICAMENTE en la información proporcionada. Si no hay información suficiente, indícalo claramente.`,
        maxTokens: 500,
        temperature: 0.3,
      });

      return answer;
    } catch (error: any) {
      return `Se encontraron ${entities.length} entidades relacionadas, pero no se pudo generar una respuesta: ${error.message}`;
    }
  }

  /**
   * Parsea respuesta del LLM a grafo de conocimiento
   * Guarda referencias a PageIndex para Q&A contextual
   */
  private parseKnowledgeGraph(
    response: string,
    documentId: string,
    pageIndexReference?: {
      page?: number;
      section?: string;
      start_index?: number;
      end_index?: number;
    },
    companyId?: string // [Mejora 2]
  ): {
    entities: CogneeEntity[];
    relations: CogneeRelation[];
  } {
    try {
      const parsed = extractFirstJSON(response);
      if (!parsed || !Array.isArray(parsed.entities)) {
        console.warn(
          `[Cognee] ⚠️  LLM no devolvió JSON válido para documento ${documentId} — 0 entidades extraídas.`,
          `Respuesta (primeros 300 chars): ${response?.slice(0, 300)}`
        );
        return { entities: [], relations: [] };
      }

      const entities: CogneeEntity[] = (parsed.entities || []).map((e: any, idx: number) => ({
        id: `${documentId}-entity-${e.id || idx}`,
        type: e.type || 'CONCEPT',
        name: e.name || 'Unknown',
        description: e.description,
        properties: {
          ...e.properties,
          // Guardar referencias a PageIndex
          page: pageIndexReference?.page,
          section: pageIndexReference?.section,
          start_index: pageIndexReference?.start_index,
          end_index: pageIndexReference?.end_index,
          documentId,
          ...(companyId ? { companyId } : {}), // [Mejora 2]
        },
      }));

      const relations: CogneeRelation[] = (parsed.relations || []).map((r: any, idx: number) => ({
        id: `${documentId}-relation-${r.id || idx}`,
        source: `${documentId}-entity-${r.source}`,
        target: `${documentId}-entity-${r.target}`,
        type: r.type || 'RELATED_TO',
        properties: {
          ...r.properties,
          documentId,
        },
      }));

      return { entities, relations };
    } catch (error: any) {
      console.error('[Cognee] Error parseando grafo:', error.message);
      return { entities: [], relations: [] };
    }
  }

  /**
   * Obtiene estadísticas del grafo de un documento específico
   */
  async getDocumentGraphStats(documentId: string): Promise<{
    entityCount: number;
    relationCount: number;
    entityTypes: Record<string, number>;
  }> {
    try {
      const [entityResult, typeResult, relationResult] = await Promise.all([
        falkorDBService.roQuery(
          "MATCH (n) WHERE n.documentId = $docId RETURN count(n) AS count",
          { docId: documentId }
        ),
        falkorDBService.roQuery(
          "MATCH (n) WHERE n.documentId = $docId RETURN labels(n)[0] AS type, count(n) AS count",
          { docId: documentId }
        ),
        falkorDBService.roQuery(
          "MATCH (a)-[r]->(b) WHERE a.documentId = $docId AND b.documentId = $docId RETURN count(r) AS count",
          { docId: documentId }
        ),
      ]);

      const entityTypes: Record<string, number> = {};
      typeResult.rows.forEach((r: any) => {
        entityTypes[r.type] = r.count;
      });

      return {
        entityCount: entityResult.rows[0]?.count || 0,
        relationCount: relationResult.rows[0]?.count || 0,
        entityTypes,
      };
    } catch (error: any) {
      console.error('[Cognee] Error obteniendo estadísticas:', error.message);
      return { entityCount: 0, relationCount: 0, entityTypes: {} };
    }
  }

  /**
   * Elimina todo el grafo de un documento específico
   */
  async deleteDocumentGraph(documentId: string): Promise<number> {
    return falkorDBService.deleteEntitiesByDocumentId(documentId);
  }
}

export const cogneeService = new CogneeService();
