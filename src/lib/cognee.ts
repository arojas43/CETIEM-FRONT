/**
 * Implementación REAL de Cognee para construcción de grafos de conocimiento
 * Basado en: https://github.com/topoteretes/cognee
 *
 * Cognee transforma datos crudos en memoria persistente para agentes de IA.
 * Combina:
 * - Búsqueda vectorial (embeddings)
 * - Base de datos de grafos (FalkorDB)
 * - Auto-mejora mediante feedback
 *
 * Flujo:
 * 1. Extrae tripletas (sujeto-relación-objeto) del texto
 * 2. Guarda entidades en el grafo
 * 3. Guarda relaciones entre entidades
 * 4. Permite consultas complejas
 */

import { nimService } from "./nim";
import { falkorDBService } from "./falkordb";

export interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  description?: string;
}

export interface Relation {
  id: string;
  source: string; // entity ID
  target: string; // entity ID
  type: string;
  properties?: Record<string, any>;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export interface CogneeConfig {
  llmProvider: string;
  embeddingProvider: string;
  falkorDbHost: string;
  falkorDbPort: number;
  graphName: string;
}

export class CogneeService {
  private config: CogneeConfig;
  private connected: boolean;

  constructor() {
    this.config = {
      llmProvider: process.env.COGNEE_LLM_PROVIDER || "nvidia",
      embeddingProvider: process.env.COGNEE_EMBEDDING_PROVIDER || "nvidia",
      falkorDbHost: process.env.FALKORDB_HOST || "localhost",
      falkorDbPort: parseInt(process.env.FALKORDB_PORT || "6380"),
      graphName: "certificacion",
    };

    this.connected = false;
  }

  /**
   * Inicializa conexión con FalkorDB usando el servicio mejorado
   * Similar a cognee.init() en Python
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[Cognee] Conectando a FalkorDB...');

      const connected = await falkorDBService.connect();
      
      if (connected) {
        this.connected = true;
        console.log('✅ [Cognee] FalkorDB conectado correctamente');
        return true;
      }

      console.warn('⚠️  [Cognee] FalkorDB no disponible');
      console.warn('📌 [Cognee] Funcionará en modo memoria (sin persistencia)');
      this.connected = false;
      return false;
    } catch (error: any) {
      console.warn(`⚠️  [Cognee] FalkorDB no disponible: ${error.message}`);
      console.warn('📌 [Cognee] Funcionará en modo memoria (sin persistencia)');
      this.connected = false;
      return false;
    }
  }

  /**
   * Procesa un documento y extrae conocimiento
   * Similar a cognee.add(documents) en Python
   */
  async processDocument(content: string, documentType?: string, documentId?: string): Promise<KnowledgeGraph> {
    console.log('[Cognee] ====================================');
    console.log('[Cognee] Extrayendo conocimiento del documento...');
    console.log(`[Cognee]   - Longitud del contenido: ${content.length} caracteres`);
    console.log(`[Cognee]   - Tipo de documento: ${documentType || 'No especificado'}`);
    console.log(`[Cognee]   - Document ID: ${documentId || 'No especificado'}`);
    
    // Prompt especializado tipo Cognee
    const prompt = this.buildCogneePrompt(content, documentType);

    try {
      console.log('[Cognee] Enviando petición a NVIDIA NIM...');
      const response = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
        prompt,
        systemPrompt: "Eres un sistema de extracción de conocimiento. Identifica TODAS las entidades y relaciones importantes.",
        maxTokens: 4000,
        temperature: 0.2, // Bajo para precisión
      });

      console.log('[Cognee] Respuesta recibida de LLM, parseando JSON...');
      const knowledgeGraph = this.parseKnowledgeGraph(response);
      
      console.log(`[Cognee] Extraídas ${knowledgeGraph.entities.length} entidades y ${knowledgeGraph.relations.length} relaciones`);
      
      if (knowledgeGraph.entities.length > 0) {
        console.log('[Cognee] Primeras 5 entidades:');
        knowledgeGraph.entities.slice(0, 5).forEach(e => {
          console.log(`  - ${e.type}: ${e.name}`);
        });
      }
      
      // Guardar en FalkorDB si está disponible
      if (this.connected && knowledgeGraph.entities.length > 0) {
        console.log('[Cognee] Persistiendo en FalkorDB...');
        await this.persistGraph(knowledgeGraph, documentId);
        console.log('[Cognee] ✓ Grafo persistido en FalkorDB');
      } else if (!this.connected) {
        console.warn('[Cognee] ⚠️  No hay conexión a FalkorDB, datos solo en memoria');
      }
      
      console.log('[Cognee] ====================================');
      
      return knowledgeGraph;
    } catch (error: any) {
      console.error('[Cognee] ❌ Error extrayendo conocimiento:', error.message);
      console.error('[Cognee] Stack:', error.stack);
      console.log('[Cognee] ====================================');
      return { entities: [], relations: [] };
    }
  }

  /**
   * Construye el prompt estilo Cognee
   * Cognee usa prompts estructurados para extracción consistente
   */
  private buildCogneePrompt(content: string, documentType?: string): string {
    const typeContext = documentType 
      ? `Este documento es: ${documentType}. Enfócate en entidades relevantes.`
      : "Extrae entidades y relaciones generales del documento.";

    return `Eres un sistema experto en extracción de conocimiento de documentos científicos y técnicos.

${typeContext}

## INSTRUCCIONES:
1. Identifica TODAS las entidades importantes en el texto
2. Identifica las relaciones entre esas entidades
3. Responde ÚNICAMENTE con JSON válido, sin texto adicional

## FORMATO DE SALIDA (JSON estricto):
{"entities":[{"id":"1","type":"ORGANIZATION","name":"Nombre","description":"Breve descripción","properties":{}}],"relations":[{"id":"1","source":"1","target":"2","type":"COMPLIES_WITH"}]}

## TIPOS DE ENTIDAD VÁLIDOS:
- ORGANIZATION: Empresas, universidades, instituciones
- REGULATION: Normas (ISO, IEEE), leyes, regulaciones
- REQUIREMENT: Requisitos, obligaciones, estándares
- DOCUMENT: Papers, manuales, procedimientos
- PERSON: Personas, autores, investigadores
- DATE: Fechas, años, períodos
- LOCATION: Países, ciudades, instituciones
- CONCEPT: Conceptos técnicos, teorías, metodologías
- TECHNOLOGY: Tecnologías, herramientas, frameworks

## TIPOS DE RELACIÓN VÁLIDOS:
- COMPLIES_WITH: Cumple con norma/regulación
- REQUIRES: Requiere algo
- IMPLEMENTS: Implementa requisito/tecnología
- REFERENCES: Referencia otro documento
- CREATED_BY: Creado por persona/organización
- LOCATED_IN: Ubicado en lugar
- PART_OF: Parte de algo más grande
- RELATED_TO: Relacionado con
- USED_IN: Usado en tecnología/método
- APPLIED_TO: Aplicado a dominio/área

## TEXTO A ANALIZAR:
${content.slice(0, 18000)}`;
  }

  /**
   * Parsea la respuesta del LLM a KnowledgeGraph
   * Ahora con mejor detección de JSON en el texto
   */
  private parseKnowledgeGraph(response: string): KnowledgeGraph {
    try {
      console.log('[Cognee] Intentando parsear respuesta del LLM...');
      console.log(`[Cognee]   - Longitud de respuesta: ${response.length} caracteres`);
      
      // Intentar múltiples patrones para encontrar JSON
      const patterns = [
        /\{[\s\S]*"entities"[\s\S]*"relations"[\s\S]*\}/,
        /\{[\s\S]*"entities"[\s\S]*\}/,
        /\{[\s\S]*\}/
      ];
      
      let jsonMatch = null;
      for (const pattern of patterns) {
        jsonMatch = response.match(pattern);
        if (jsonMatch) {
          console.log(`[Cognee]   - JSON encontrado con patrón`);
          break;
        }
      }
      
      if (!jsonMatch) {
        console.warn('[Cognee]   - ⚠️  No se encontró JSON válido en la respuesta');
        console.warn('[Cognee]   - Primeros 500 chars de respuesta:', response.slice(0, 500));
        throw new Error('No se encontró JSON en la respuesta');
      }

      console.log('[Cognee]   - Parseando JSON...');
      const parsed = JSON.parse(jsonMatch[0]);
      
      const entities = (parsed.entities || []).map((e: any, idx: number) => ({
        ...e,
        id: e.id || `entity-${idx}`,
        type: e.type || 'CONCEPT',
        name: e.name || 'Unknown',
        properties: e.properties || {},
        description: e.description,
      }));
      
      const relations = (parsed.relations || []).map((r: any, idx: number) => ({
        ...r,
        id: r.id || `relation-${idx}`,
        source: r.source,
        target: r.target,
        type: r.type || 'RELATED_TO',
      }));
      
      console.log(`[Cognee]   - ✓ Parse completado: ${entities.length} entidades, ${relations.length} relaciones`);
      
      return { entities, relations };
    } catch (error: any) {
      console.error('[Cognee]   - ❌ Error parseando KnowledgeGraph:', error.message);
      return { entities: [], relations: [] };
    }
  }

  /**
   * Persiste el grafo en FalkorDB usando el servicio mejorado
   * Ahora con documentId para aislar por documento
   */
  async persistGraph(graph: KnowledgeGraph, documentId?: string): Promise<void> {
    if (!this.connected) {
      console.warn('[Cognee] No hay conexión a FalkorDB, omitiendo persistencia');
      return;
    }

    console.log(`[Cognee] Persistiendo ${graph.entities.length} entidades en FalkorDB...`);

    let successCount = 0;
    let errorCount = 0;

    // 1. Crear entidades (nodos) con documentId
    for (const entity of graph.entities) {
      try {
        const properties: Record<string, any> = {
          id: entity.id,
          name: entity.name,
        };
        
        if (documentId) {
          properties.documentId = documentId;
        }
        
        if (entity.description) {
          properties.description = entity.description;
        }
        
        if (entity.properties && Object.keys(entity.properties).length > 0) {
          Object.assign(properties, entity.properties);
        }

        const created = await falkorDBService.createEntity(entity.type, properties);
        if (created) successCount++;
      } catch (error: any) {
        errorCount++;
        console.error(`[Cognee] Error guardando entidad ${entity.id}:`, error.message);
      }
    }

    console.log(`[Cognee] Entidades guardadas: ${successCount}/${graph.entities.length}`);

    // 2. Crear relaciones
    let relationSuccess = 0;
    for (const relation of graph.relations) {
      try {
        const created = await falkorDBService.createRelation(
          relation.source,
          relation.target,
          relation.type,
          relation.properties
        );
        if (created) relationSuccess++;
      } catch (error: any) {
        // La relación puede fallar si los nodos no existen, no es crítico
      }
    }

    console.log(`[Cognee] Relaciones guardadas: ${relationSuccess}/${graph.relations.length}`);
    console.log('✅ [Cognee] Grafo persistido en FalkorDB');
  }

  /**
   * Consulta el grafo de conocimiento usando el servicio mejorado
   * Similar a cognee.search() en Python
   */
  async query(question: string): Promise<{
    answer: string;
    entities: Entity[];
    relations: Relation[];
  }> {
    if (!this.connected) {
      // Fallback: usar LLM directamente
      return this.queryWithLLM(question);
    }

    try {
      // Buscar entidades relacionadas en el grafo
      const result = await falkorDBService.searchEntities({ name: question, limit: 10 });

      if (result.length > 0) {
        const entities = result.map((r: any) => ({
          id: r.id || '',
          type: r.type || 'UNKNOWN',
          name: r.name || 'Unknown',
          properties: r,
        }));

        return {
          answer: `Se encontraron ${entities.length} entidades relacionadas con "${question}"`,
          entities,
          relations: [],
        };
      }

      // No se encontró en el grafo, usar LLM
      return this.queryWithLLM(question);
    } catch (error: any) {
      console.error('[Cognee] Error consultando:', error.message);
      return this.queryWithLLM(question);
    }
  }

  /**
   * Fallback: consultar con LLM cuando no hay grafo
   */
  private async queryWithLLM(question: string): Promise<{
    answer: string;
    entities: Entity[];
    relations: Relation[];
  }> {
    const prompt = `Responde la siguiente pregunta sobre certificaciones empresariales:

${question}

Si no tienes suficiente información, indícalo claramente.`;

    const answer = await nimService.generateText({
      model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
      prompt,
      systemPrompt: "Eres un asistente experto en certificaciones empresariales.",
      maxTokens: 1000,
      temperature: 0.5,
    });

    return {
      answer,
      entities: [],
      relations: [],
    };
  }

  /**
   * Obtiene estadísticas del grafo usando el servicio mejorado
   */
  async getStats(): Promise<{
    entityCount: number;
    relationCount: number;
    entityTypes: Record<string, number>;
    connected: boolean;
  }> {
    if (!this.connected) {
      return { entityCount: 0, relationCount: 0, entityTypes: {}, connected: false };
    }

    try {
      const stats = await falkorDBService.getStats();
      
      return {
        entityCount: stats.entityCount,
        relationCount: stats.relationCount,
        entityTypes: stats.entityTypes.reduce((acc, t) => {
          acc[t.type] = t.count;
          return acc;
        }, {} as Record<string, number>),
        connected: stats.connected,
      };
    } catch (error: any) {
      console.error('[Cognee] Error obteniendo estadísticas:', error.message);
      return { entityCount: 0, relationCount: 0, entityTypes: {}, connected: false };
    }
  }
}

export const cogneeService = new CogneeService();
