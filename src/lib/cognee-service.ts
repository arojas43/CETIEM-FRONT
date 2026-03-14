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

export type CogneeDomain = 'medical' | 'legal' | 'technical' | 'academic' | 'custom';

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
  medical: {
    entityTypes: [
      'DISEASE: Enfermedades, síndromes, condiciones médicas',
      'TREATMENT: Tratamientos, terapias, procedimientos terapéuticos',
      'ANATOMY: Partes del cuerpo, órganos, tejidos, sistemas',
      'MEDICATION: Medicamentos, drogas, fármacos, sustancias',
      'SYMPTOM: Síntomas, signos clínicos, manifestaciones',
      'DIAGNOSIS: Criterios diagnósticos, pruebas diagnósticas',
      'PROCEDURE: Procedimientos médicos, cirugías, intervenciones',
      'ORGANIZATION: Instituciones médicas, hospitales, laboratorios',
    ],
    relationTypes: [
      'TREATS: Tratamiento trata enfermedad/síntoma',
      'CAUSES: Causa efecto o condición',
      'ORIGINATES_FROM: Se origina en tejido/órgano',
      'LOCATED_IN: Ubicado en anatomía',
      'DIAGNOSED_BY: Diagnosticado por prueba/procedimiento',
      'SYMPTOM_OF: Síntoma de enfermedad',
      'CONTRAINDICATED_WITH: Contraindicado con medicamento/tratamiento',
      'PRESCRIBED_FOR: Prescrito para condición',
    ],
    systemPrompt: 'Eres un experto en extracción de conocimiento médico de documentos. Identifica enfermedades, tratamientos, anatomía, procedimientos, síntomas y diagnósticos.',
    exampleOutput: `{"entities": [{"id": "1", "type": "DISEASE", "name": "Liposarcoma", "description": "Tumor maligno del tejido adiposo"}], "relations": []}`,
  },
  legal: {
    entityTypes: [
      'ORGANIZATION: Empresas, instituciones, organizaciones, entidades',
      'REGULATION: Normas, leyes, reglamentos, estándares (ISO, NOM, etc.)',
      'REQUIREMENT: Requisitos, obligaciones, mandatos',
      'PERSON: Personas físicas, nombres propios, cargos',
      'DATE: Fechas importantes, plazos, vigencias',
      'DOCUMENT: Documentos, certificados, reportes, actas',
      'PROCEDURE: Procedimientos, procesos, metodologías',
      'LOCATION: Ubicaciones, sedes, instalaciones',
    ],
    relationTypes: [
      'COMPLIES_WITH: Cumple con norma/regulación',
      'IMPLEMENTS: Implementa procedimiento/requisito',
      'REQUIRES: Requiere documento/acción',
      'APPLIES_TO: Aplica a organización/persona/área',
      'ISSUED_BY: Emitido por organización/autoridad',
      'VALID_UNTIL: Válido hasta fecha',
      'LOCATED_IN: Ubicado en lugar',
      'RESPONSIBLE_FOR: Responsable de procedimiento/área',
    ],
    systemPrompt: 'Eres un experto en extracción de conocimiento de documentos legales y normativos. Identifica normas, requisitos, organizaciones, fechas y procedimientos.',
    exampleOutput: `{"entities": [{"id": "1", "type": "REGULATION", "name": "ISO 9001", "description": "Estándar de gestión de calidad"}], "relations": []}`,
  },
  technical: {
    entityTypes: [
      'SYSTEM: Sistemas, subsistemas, componentes',
      'EQUIPMENT: Equipos, máquinas, dispositivos',
      'SPECIFICATION: Especificaciones técnicas, parámetros',
      'MATERIAL: Materiales, sustancias, compuestos',
      'PROCESS: Procesos, operaciones, métodos',
      'STANDARD: Estándares técnicos, normas',
      'MEASUREMENT: Mediciones, unidades, rangos',
      'FAILURE: Fallos, errores, anomalías',
    ],
    relationTypes: [
      'PART_OF: Parte de sistema/equipo',
      'CONTAINS: Contiene componente/material',
      'OPERATES_AT: Opera en condición/rango',
      'REQUIRES_MATERIAL: Requiere material/sustancia',
      'MEASURES_BY: Medido por instrumento',
      'FAILS_WHEN: Falla cuando condición',
      'COMPLIES_WITH: Cumple con estándar/norma',
      'PRODUCES: Produce resultado/subproducto',
    ],
    systemPrompt: 'Eres un experto en extracción de conocimiento de documentos técnicos. Identifica sistemas, equipos, especificaciones, materiales y procesos.',
    exampleOutput: `{"entities": [{"id": "1", "type": "EQUIPMENT", "name": "Compresor centrífugo", "description": "Equipo de compresión de gas"}], "relations": []}`,
  },
  academic: {
    entityTypes: [
      'CONCEPT: Conceptos, teorías, ideas principales',
      'THEORY: Teorías, modelos teóricos, marcos conceptuales',
      'METHOD: Métodos, metodologías, enfoques',
      'FINDING: Hallazgos, resultados, conclusiones',
      'AUTHOR: Autores, investigadores, académicos',
      'INSTITUTION: Instituciones, universidades, centros',
      'PUBLICATION: Publicaciones, artículos, libros',
      'FIELD: Campos de estudio, disciplinas',
    ],
    relationTypes: [
      'PROPOSED_BY: Propuesto por autor',
      'SUPPORTS: Soporta teoría/hipótesis',
      'CONTRADICTS: Contradice teoría/hallazgo',
      'BASED_ON: Basado en teoría/método',
      'APPLIED_TO: Aplicado a campo/problema',
      'PUBLISHED_IN: Publicado en publicación',
      'AFFILIATED_WITH: Afiliado con institución',
      'EXTENDS: Extiende teoría/método',
    ],
    systemPrompt: 'Eres un experto en extracción de conocimiento de documentos académicos. Identifica conceptos, teorías, métodos, hallazgos y autores.',
    exampleOutput: `{"entities": [{"id": "1", "type": "THEORY", "name": "Teoría del Aprendizaje Social", "description": "Teoría sobre aprendizaje observacional"}], "relations": []}`,
  },
  custom: {
    entityTypes: [
      'ENTITY: Entidad genérica',
      'CONCEPT: Concepto importante',
      'OBJECT: Objeto, elemento',
      'PERSON: Persona',
      'ORGANIZATION: Organización',
    ],
    relationTypes: [
      'RELATED_TO: Relacionado con',
      'PART_OF: Parte de',
      'ASSOCIATED_WITH: Asociado con',
    ],
    systemPrompt: 'Eres un experto en extracción de conocimiento de documentos. Identifica entidades y relaciones importantes.',
    exampleOutput: `{"entities": [{"id": "1", "type": "ENTITY", "name": "Entidad ejemplo"}], "relations": []}`,
  },
};

export class CogneeService {
  private graphName: string = 'certificacion';
  private defaultDomain: CogneeDomain = 'legal'; // Default para certificación empresarial

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
    }
  ): Promise<{ entities: CogneeEntity[]; relations: CogneeRelation[] }> {
    const selectedDomain = domain || this.defaultDomain;
    const prompt = this.buildDomainPrompt(content, documentName, selectedDomain);

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
  private buildDomainPrompt(content: string, documentName: string, domain: CogneeDomain): string {
    const config = DOMAIN_CONFIGS[domain];

    return `Analiza el siguiente fragmento de documento y extrae TODAS las entidades y relaciones importantes.

Documento: ${documentName}
Dominio: ${domain.toUpperCase()}

## INSTRUCCIONES:
1. Identifica entidades del dominio específico
2. Identifica relaciones entre entidades
3. Responde ÚNICAMENTE con JSON válido

## FORMATO DE SALIDA:
${config.exampleOutput}

## TIPOS DE ENTIDAD VÁLIDOS:
${config.entityTypes.map(t => `- ${t}`).join('\n')}

## TIPOS DE RELACIÓN VÁLIDOS:
${config.relationTypes.map(t => `- ${t}`).join('\n')}

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
      const jsonMatch = response.match(/\{[\s\S]*"entities"[\s\S]*\}/);
      if (!jsonMatch) {
        return { entities: [], relations: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);

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
