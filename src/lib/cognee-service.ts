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
  private graphName: string = 'certificacion';
  private defaultDomain: CogneeDomain = 'industria'; // Default para certificación empresarial ESG

  /**
   * Extrae conocimiento de un chunk de texto usando LLM
   * Soporta múltiples dominios: medical, legal, technical, academic, custom
   * 
   * IMPORTANTE: Guarda referencias a PageIndex (page, section, offsets)
   * para permitir Q&A contextual preciso
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
    extractionConfig?: ExtractionConfig
  ): Promise<{ entities: CogneeEntity[]; relations: CogneeRelation[] }> {
    const selectedDomain = domain || this.defaultDomain;
    const prompt = this.buildDomainPrompt(content, documentName, selectedDomain, extractionConfig);

    try {
      const config = DOMAIN_CONFIGS[selectedDomain];
      const response = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt,
        systemPrompt: config.systemPrompt,
        maxTokens: 4000,
        temperature: 0.2,
      });

      return this.parseKnowledgeGraph(response, documentId, pageIndexReference);
    } catch (error: any) {
      console.error('[Cognee] Error extrayendo conocimiento:', error.message);
      return { entities: [], relations: [] };
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
    documentId: string
  ): Promise<{ saved: number; failed: number }> {
    let saved = 0;
    let failed = 0;

    // Guardar entidades en batch agrupado por tipo (UNWIND)
    if (entities.length > 0) {
      try {
        const batchInput = entities.map(entity => ({
          label: entity.type,
          properties: {
            id: entity.id,
            name: entity.name,
            documentId, // CLAVE: aísla por documento
            ...(entity.description ? { description: entity.description } : {}),
            ...(entity.properties ? entity.properties : {}),
          },
        }));
        const created = await falkorDBService.createEntitiesBatch(batchInput);
        saved += created;
        failed += entities.length - created;
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
        saved++;
      } catch {
        failed++;
      }
    }

    return { saved, failed };
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
    }
  ): Promise<CogneeSearchResult> {
    const limit = options?.limit || 20;
    const includeRelations = options?.includeRelations !== false;
    const domain = options?.domain || this.defaultDomain;

    // 1. Buscar entidades en el grafo del documento específico
    const entitiesResult = await falkorDBService.roQuery(`
      MATCH (n)
      WHERE n.documentId = "${documentId}"
        AND (n.name CONTAINS "${query}" OR n.description CONTAINS "${query}")
      RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.id AS id
      LIMIT ${limit}
    `);

    // 2. Si no encuentra por nombre, buscar por tipos del dominio correspondiente
    let entities: CogneeEntity[] = entitiesResult.rows.map(r => ({
      id: r.id,
      type: r.type,
      name: r.name,
      description: r.desc,
    }));

    if (entities.length === 0) {
      // Obtener tipos de entidad válidos para este dominio
      const domainEntityTypes = DOMAIN_CONFIGS[domain].entityTypes
        .map(t => `'${t.split(':')[0].trim()}'`)
        .join(', ');

      const typeSearch = await falkorDBService.roQuery(`
        MATCH (n)
        WHERE n.documentId = "${documentId}"
          AND labels(n)[0] IN [${domainEntityTypes}]
        RETURN labels(n)[0] AS type, n.name AS name, n.description AS desc, n.id AS id
        LIMIT ${limit}
      `);

      entities = typeSearch.rows.map(r => ({
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.desc,
      }));
    }
    
    // 3. Obtener relaciones si se solicita
    let relations: CogneeRelation[] = [];
    if (includeRelations && entities.length > 0) {
      const entityIds = entities.map(e => `"${e.id}"`).join(',');
      const relationsResult = await falkorDBService.roQuery(`
        MATCH (a)-[r]->(b)
        WHERE a.documentId = "${documentId}" AND b.documentId = "${documentId}"
          AND a.id IN [${entityIds}]
        RETURN a.name AS source, type(r) AS type, b.name AS target
        LIMIT 50
      `);
      
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
      sources: entities.map(e => ({
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
    }
  ): {
    entities: CogneeEntity[];
    relations: CogneeRelation[];
  } {
    try {
      const parsed = extractFirstJSON(response);
      if (!parsed || !Array.isArray(parsed.entities)) {
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
      // Contar entidades por documento
      const entityResult = await falkorDBService.roQuery(`
        MATCH (n)
        WHERE n.documentId = "${documentId}"
        RETURN count(n) AS count
      `);

      // Contar por tipo
      const typeResult = await falkorDBService.roQuery(`
        MATCH (n)
        WHERE n.documentId = "${documentId}"
        RETURN labels(n)[0] AS type, count(n) AS count
      `);

      // Contar relaciones
      const relationResult = await falkorDBService.roQuery(`
        MATCH (a)-[r]->(b)
        WHERE a.documentId = "${documentId}" AND b.documentId = "${documentId}"
        RETURN count(r) AS count
      `);
      
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
