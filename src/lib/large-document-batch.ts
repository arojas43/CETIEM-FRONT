/**
 * Procesamiento por lotes de chunks para documentos grandes
 * Analiza múltiples chunks en paralelo con límites de tasa
 */

import { nimService } from './nim';
import { falkorDBService } from './falkordb';
import type { CogneeDomain } from './cognee-service';
import type { TextChunk, ChunkAnalysis, ProcessingProgress } from './large-document-types';
import { DOCUMENT_LIMITS } from './large-document-types';

/**
 * Analiza múltiples chunks de texto extrayendo entidades
 */
export async function analyzeChunksInBatch(
  chunks: TextChunk[],
  documentId: string,
  documentName: string,
  onProgress?: (progress: ProcessingProgress) => void,
  domain?: CogneeDomain
): Promise<{
  totalEntities: number;
  totalRelations: number;
  chunksProcessed: number;
}> {
  const startTime = Date.now();
  const batchSize = DOCUMENT_LIMITS.BATCH_SIZE;
  const totalChunks = chunks.length;

  // Implementar límite de MAX_BATCHES (CONFIGURABLE)
  const MAX_BATCHES = parseInt(process.env.MAX_BATCHES || '100');
  const maxChunksToProcess = MAX_BATCHES * batchSize;

  if (chunks.length > maxChunksToProcess) {
    console.warn(`[BatchAnalyzer] Limitando a ${maxChunksToProcess} chunks (${MAX_BATCHES} lotes de ${batchSize})`);
    console.warn(`[BatchAnalyzer] Chunks originales: ${chunks.length}, Chunks a procesar: ${maxChunksToProcess}`);
    chunks = chunks.slice(0, maxChunksToProcess);
  }

  console.log(`[BatchAnalyzer] Iniciando análisis de ${chunks.length} chunks en lotes de ${batchSize}`);

  let totalEntities = 0;
  let totalRelations = 0;
  let chunksProcessed = 0;
  let errors = 0;

  // Inicializar FalkorDB
  const connected = await falkorDBService.connect();
  if (!connected) {
    console.warn('[BatchAnalyzer] FalkorDB no disponible, solo análisis en memoria');
  }

  // Procesar en lotes
  for (let i = 0; i < totalChunks; i += batchSize) {
    const batchStart = i;
    const batchEnd = Math.min(i + batchSize, totalChunks);
    const batchChunks = chunks.slice(batchStart, batchEnd);
    
    console.log(`[BatchAnalyzer] Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalChunks / batchSize)} (chunks ${batchStart + 1}-${batchEnd})`);
    
    // Procesar lote en paralelo con límite de concurrencia
    const batchResults = await processBatchWithConcurrency(
      batchChunks,
      documentId,
      documentName,
      3, // concurrencia máxima
      domain
    );
    
    // Acumular resultados
    for (const result of batchResults) {
      if (result.error) {
        errors++;
        console.warn(`[BatchAnalyzer] Error en chunk ${result.chunkId}:`, result.error);
      } else {
        totalEntities += result.entities.length;
        totalRelations += result.relations.length;
      }
      chunksProcessed++;
    }
    
    // Reportar progreso
    if (onProgress) {
      onProgress({
        status: 'ANALYZING',
        percentage: Math.round((chunksProcessed / totalChunks) * 100),
        currentStep: chunksProcessed,
        totalSteps: totalChunks,
        details: {
          chunksProcessed,
          totalChunks,
          entitiesExtracted: totalEntities,
        },
        startedAt: startTime,
        updatedAt: Date.now(),
      });
    }
    
    // Pausa entre lotes para no saturar API
    if (batchEnd < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`[BatchAnalyzer] Completado en ${(processingTime / 1000).toFixed(2)}s`);
  console.log(`[BatchAnalyzer] Entidades: ${totalEntities}, Relaciones: ${totalRelations}, Errores: ${errors}`);

  return {
    totalEntities,
    totalRelations,
    chunksProcessed,
  };
}

/**
 * Procesa un lote con concurrencia limitada usando un pool de workers
 */
async function processBatchWithConcurrency(
  chunks: TextChunk[],
  documentId: string,
  documentName: string,
  maxConcurrency: number = 3,
  domain?: CogneeDomain
): Promise<ChunkAnalysis[]> {
  const results: ChunkAnalysis[] = new Array(chunks.length);
  const queue = chunks.map((chunk, index) => ({ chunk, index }));
  let queueIndex = 0;

  async function worker() {
    while (true) {
      const item = queue[queueIndex++];
      if (!item) break;
      results[item.index] = await processSingleChunk(item.chunk, documentId, documentName, domain);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrency, chunks.length) }, worker);
  await Promise.all(workers);

  return results;
}

/**
 * Procesa un solo chunk extrayendo entidades
 */
async function processSingleChunk(
  chunk: TextChunk,
  documentId: string,
  documentName: string,
  _domain?: CogneeDomain
): Promise<ChunkAnalysis> {
  const startTime = Date.now();
  
  try {
    // Construir prompt para este chunk
    const prompt = buildChunkPrompt(chunk.content, documentName);
    
    // Calcular timeout basado en tamaño del chunk
    // Para documentos médicos, usar timeout extendido
    const timeout = DOCUMENT_LIMITS.CHUNK_TIMEOUT || 300000; // 5 minutos por defecto
    
    console.log(`[ChunkProcessor] Chunk ${chunk.id}: ${chunk.metadata.charCount} chars, timeout: ${timeout/1000}s`);
    
    // Llamar a LLM con timeout extendido
    const response = await Promise.race([
      nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt,
        systemPrompt: 'Eres un sistema experto en extracción de conocimiento de documentos médicos. Identifica TODAS las entidades y relaciones importantes: enfermedades, tratamientos, medicamentos, procedimientos, anatomía, etc. Responde ÚNICAMENTE con JSON válido.',
        maxTokens: 4000,
        temperature: 0.2,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout en análisis de chunk (> ${timeout/1000}s)`)), timeout)
      ),
    ]);
    
    // Parsear respuesta
    const entities = parseEntitiesFromResponse(response, chunk.id);
    const relations = parseRelationsFromResponse(response, chunk.id);
    
    // Persistir en FalkorDB
    if (entities.length > 0) {
      await persistChunkEntities(entities, relations, documentId);
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      chunkId: chunk.id,
      entities,
      relations,
      processingTime,
    };
  } catch (error: any) {
    console.error(`[ChunkProcessor] Error procesando chunk ${chunk.id}:`, error.message);
    
    return {
      chunkId: chunk.id,
      entities: [],
      relations: [],
      processingTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Construye prompt para analizar un chunk
 */
function buildChunkPrompt(content: string, documentName: string): string {
  return `Analiza el siguiente fragmento de documento y extrae TODAS las entidades y relaciones importantes.

Documento: ${documentName}

## INSTRUCCIONES:
1. Identifica entidades: organizaciones, normas, requisitos, personas, fechas, conceptos
2. Identifica relaciones entre entidades
3. Responde ÚNICAMENTE con JSON válido

## FORMATO DE SALIDA:
{
  "entities": [
    {"id": "1", "type": "ORGANIZATION", "name": "Nombre", "description": "Descripción breve"},
    {"id": "2", "type": "REGULATION", "name": "ISO 9001", "description": "Norma de calidad"}
  ],
  "relations": [
    {"id": "1", "source": "1", "target": "2", "type": "COMPLIES_WITH"}
  ]
}

## TIPOS VÁLIDOS:
ORGANIZATION, REGULATION, REQUIREMENT, DOCUMENT, PERSON, DATE, LOCATION, CONCEPT, TECHNOLOGY

## FRAGMENTO A ANALIZAR:
${content.slice(0, DOCUMENT_LIMITS.CHUNK_SIZE)}`;
}

/**
 * Parsea entidades de la respuesta del LLM
 */
function parseEntitiesFromResponse(response: string, chunkId: string): Array<{
  id: string;
  type: string;
  name: string;
  description?: string;
  confidence: number;
}> {
  try {
    // Intentar extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*"entities"[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[Parser] No se encontró JSON válido en la respuesta');
      return [];
    }

    let jsonStr = jsonMatch[0];
    
    // Limpieza básica de JSON: eliminar caracteres de control problemáticos
    jsonStr = jsonStr
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Eliminar caracteres de control
      .replace(/,\s*}/g, '}')  // Eliminar comas antes de }
      .replace(/,\s*]/g, ']'); // Eliminar comas antes de ]

    const parsed = JSON.parse(jsonStr);
    return (parsed.entities || []).map((e: any, idx: number) => ({
      id: `${chunkId}-entity-${e.id || idx}`,
      type: e.type || 'CONCEPT',
      name: e.name || 'Unknown',
      description: e.description,
      confidence: 0.8, // Confianza base, se podría mejorar con análisis
    }));
  } catch (error: any) {
    console.warn('[Parser] Error parseando entidades:', error.message);
    console.warn('[Parser] JSON problemático (primeros 500 chars):', response.slice(0, 500));
    return [];
  }
}

/**
 * Parsea relaciones de la respuesta del LLM
 */
function parseRelationsFromResponse(response: string, chunkId: string): Array<{
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
}> {
  try {
    const jsonMatch = response.match(/\{[\s\S]*"entities"[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    let jsonStr = jsonMatch[0];
    
    // Limpieza básica de JSON
    jsonStr = jsonStr
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    const parsed = JSON.parse(jsonStr);
    return (parsed.relations || []).map((r: any, idx: number) => ({
      id: `${chunkId}-relation-${r.id || idx}`,
      source: `${chunkId}-entity-${r.source}`,
      target: `${chunkId}-entity-${r.target}`,
      type: r.type || 'RELATED_TO',
      confidence: 0.8,
    }));
  } catch (error: any) {
    console.warn('[Parser] Error parseando relaciones:', error.message);
    return [];
  }
}

/**
 * Persiste entidades y relaciones en FalkorDB usando UNWIND batch por tipo.
 * Reemplaza las N queries individuales por una query por label — mucho más rápido.
 */
async function persistChunkEntities(
  entities: Array<{ id: string; type: string; name: string; description?: string; confidence: number }>,
  relations: Array<{ id: string; source: string; target: string; type: string }>,
  documentId: string
): Promise<void> {
  try {
    if (entities.length > 0) {
      // Batch CREATE agrupado por tipo de entidad
      const batchInput = entities.map(e => ({
        label: e.type,
        properties: {
          id: e.id,
          name: e.name,
          description: e.description,
          documentId,
          confidence: e.confidence,
        },
      }));
      const created = await falkorDBService.createEntitiesBatch(batchInput);
      console.log(`[FalkorDB] Batch: ${created}/${entities.length} entidades creadas`);
    }

    // Relaciones siguen siendo individuales (requieren MATCH de nodos existentes)
    for (const relation of relations) {
      await falkorDBService.createRelation(relation.source, relation.target, relation.type);
    }

    if (relations.length > 0) {
      console.log(`[FalkorDB] Persistidas ${relations.length} relaciones`);
    }
  } catch (error: any) {
    console.error('[FalkorDB] Error persistiendo entidades:', error.message);
  }
}

/**
 * Calcula timeout óptimo basado en tamaño del documento
 */
export function calculateTimeout(fileSizeBytes: number): number {
  const timeoutPerMB = DOCUMENT_LIMITS.TIMEOUT_PER_MB;
  const sizeInMB = fileSizeBytes / (1024 * 1024);
  
  const calculated = sizeInMB * timeoutPerMB;
  
  return Math.min(
    DOCUMENT_LIMITS.MAX_TIMEOUT,
    Math.max(DOCUMENT_LIMITS.MIN_TIMEOUT, calculated)
  );
}
