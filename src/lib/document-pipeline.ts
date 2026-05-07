/**
 * Pipeline de procesamiento de documentos — fuente única de verdad.
 *
 * Expone tres funciones públicas:
 *   runIndexing     → Phase 1: PDF → PageIndex → PostgreSQL
 *   runAnalysis     → Phase 2: PageIndex → Cognee/NIM → FalkorDB
 *   runFullPipeline → Ambas fases en secuencia, sin cola (escape hatch síncrono)
 *
 * Los workers de BullMQ (queue/index.ts) llaman a runIndexing / runAnalysis.
 * La ruta /api/documents/[id]/process llama a runFullPipeline.
 */

import Bottleneck from 'bottleneck';
import { prisma } from './db';
import { storageService } from './storage';
import { pageIndexService } from './pageindex';
import { cogneeService } from './cognee-service';
import type { CogneeDomain, ExtractionConfig } from './cognee-service';
import { cogneeClient } from './cognee-client';
import { publishProgress } from './progress-publisher';

export interface ProcessResult {
  success: boolean;
  documentId: string;
  status?: string;
  entities?: number;
  indices?: number;
  duration?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidad compartida de progreso
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProgress(
  documentId: string,
  step: string,
  percentage: number,
  details: Record<string, any> = {}
): Promise<void> {
  const pct = Math.min(percentage, 100);
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingProgress: {
          step,
          percentage: pct,
          details,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  } catch {
    // Non-critical: never interrupt processing for a progress write failure
  }
  // Publish to Redis so SSE subscribers receive real-time updates
  await publishProgress(documentId, { step, percentage: pct, details });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Indexación (PDF → PageIndex → PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae la estructura del PDF y la persiste como árbol de nodos PageIndex.
 * Soporta documentos pequeños (<50MB, pdfjs) y grandes (>50MB, pdftotext).
 * Establece status=INDEXED al finalizar. No encola análisis (responsabilidad del caller).
 */
export async function runIndexing(documentId: string): Promise<{ indicesCreated: number }> {
  const startTime = Date.now();
  console.log(`[PageIndex] Indexando documento: ${documentId}`);

  try {
    await updateProgress(documentId, 'Iniciando PageIndex', 5, { stage: 'initializing' });

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento ${documentId} no encontrado en la base de datos`);
    console.log(`[PageIndex] ✓ Documento encontrado: ${document.name}`);

    await updateProgress(documentId, 'Cargando metadatos', 15, { stage: 'metadata' });
    const metadata = await storageService.getMetadata(documentId);
    if (!metadata) throw new Error(`Metadatos no encontrados para ${documentId}`);

    const fileSize = document.size || 0;
    const isLargeDocument = fileSize > 50 * 1024 * 1024;
    console.log(`[PageIndex] Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB, Grande: ${isLargeDocument}`);
    await updateProgress(documentId, `Analizando PDF (${(fileSize / 1024 / 1024).toFixed(1)}MB)`, 20, {
      stage: 'analyzing', fileSize, isLargeDocument,
    });

    const pdfPath = await storageService.getLocalPath(documentId);

    const fs = await import('fs');
    if (!fs.default.existsSync(pdfPath)) {
      throw new Error(`Archivo PDF no encontrado en: ${pdfPath}`);
    }

    let indicesCreated = 0;

    if (isLargeDocument) {
      await updateProgress(documentId, 'Extrayendo texto (documento grande)', 30, { stage: 'extracting_large' });
      const { extractTextFromPDFWithPdftotext } = await import('./large-document-pdftotext');

      const result = await extractTextFromPDFWithPdftotext(pdfPath, fileSize, (progress) => {
        const pct = 30 + (progress.percentage * 0.2);
        updateProgress(documentId, `Extrayendo texto: ${progress.percentage.toFixed(0)}%`, pct, {
          stage: 'extracting', extractionProgress: progress,
        });
      });

      if (!result || result.totalPages === 0 || result.chunks.length === 0) {
        await prisma.pageIndex.create({
          data: {
            documentId, level: 0, title: 'Error en extracción',
            content: 'No se pudo extraer texto del PDF. Puede estar corrupto o protegido.',
            page: 0, metadata: { error: true, fileSize }, parentId: null,
          },
        });
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'FAILED', description: 'Error: No se pudo extraer texto del PDF' },
        });
        return { indicesCreated: 0 };
      }

      await prisma.document.update({
        where: { id: documentId },
        data: { description: `Texto extraído: ${result.text.length} chars, ~${result.totalPages} páginas, ${result.chunks.length} chunks` },
      });

      const nodes = result.chunks.map((chunk, index) => ({
        id: chunk.id,
        level: 1,
        title: `Sección ${index + 1}`,
        content: chunk.content.slice(0, 10000),
        page: Math.floor(index / 10) + 1,
        metadata: { chunkIndex: chunk.index, charCount: chunk.metadata.charCount, streaming: true, method: 'pdftotext' },
        parentId: null as string | null,
      }));

      const createdNodes = new Map<string, string>();
      const batchSize = 50;
      for (let i = 0; i < nodes.length; i += batchSize) {
        for (const node of nodes.slice(i, i + batchSize)) {
          try {
            const created = await prisma.pageIndex.create({
              data: { documentId, level: node.level, title: node.title, content: node.content, page: node.page, metadata: node.metadata, parentId: node.parentId },
            });
            createdNodes.set(node.id, created.id);
          } catch (err: any) {
            console.error(`[PageIndex] Error guardando nodo ${node.id}:`, err.message);
          }
        }
      }
      indicesCreated = createdNodes.size;
      console.log(`[PageIndex] ✓ Índice guardado: ${indicesCreated}/${nodes.length} nodos`);

    } else {
      const pdfBuffer = fs.default.readFileSync(pdfPath);
      console.log(`[PageIndex] ✓ PDF leído: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      await updateProgress(documentId, 'Extrayendo estructura', 40, { stage: 'extracting_structure' });
      let pageIndex;
      try {
        pageIndex = await pageIndexService.buildIndex(documentId, pdfBuffer, document.name);
      } catch (err: any) {
        throw new Error(`Error en PageIndex: ${err.message}`);
      }

      await updateProgress(documentId, 'Guardando índices', 48, { stage: 'saving_indices' });
      const nodes = pageIndexService.flattenNodes(pageIndex);
      const createdNodes = new Map<string, string>();
      const batchSize = 50;

      for (let i = 0; i < nodes.length; i += batchSize) {
        const currentProgress = 48 + ((i / nodes.length) * 2);
        await updateProgress(documentId, `Guardando índices: ${Math.min(i + batchSize, nodes.length)}/${nodes.length}`, currentProgress, {
          stage: 'saving', saved: i, total: nodes.length,
        });
        for (const node of nodes.slice(i, i + batchSize)) {
          try {
            const parentId = node.parentId && node.level > 0 ? createdNodes.get(node.parentId) || null : null;
            const created = await prisma.pageIndex.create({
              data: {
                documentId, level: node.level, title: node.title,
                content: node.content?.slice(0, 10000) || '',
                page: node.page,
                metadata: { ...((node.metadata as object) || {}), endPage: node.endPage },
                parentId,
              },
            });
            createdNodes.set(node.id, created.id);
          } catch (err: any) {
            console.error(`[PageIndex] Error guardando nodo ${node.id}:`, err.message);
          }
        }
      }
      indicesCreated = createdNodes.size;
      console.log(`[PageIndex] ✓ Índice guardado: ${indicesCreated}/${nodes.length} nodos`);
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: 'INDEXED' } });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PageIndex] ✅ Indexación completada en ${duration}s`);
    await updateProgress(documentId, '✓ Indexación completada', 55, { stage: 'completed', duration, indicesCreated });
    await publishProgress(documentId, { step: '✓ Indexación completada', percentage: 55, status: 'INDEXED' });

    return { indicesCreated };

  } catch (error: any) {
    console.error(`[PageIndex] ❌ Error en indexación:`, error.message);
    await prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED' } });
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Análisis IA (PageIndex → Cognee/NIM → FalkorDB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae entidades y relaciones de los nodos PageIndex y las persiste en FalkorDB.
 * Soporta procesamiento por micro-batches paralelos (COGNEE_PARALLEL_CHUNKS).
 * Establece status=ANALYZED (o INDEXED si no se extraen entidades).
 */
export async function runAnalysis(
  documentId: string,
  _extractionConfig?: ExtractionConfig
): Promise<{ entitiesExtracted: number }> {
  const startTime = Date.now();
  console.log(`\n[AI] ================================`);
  console.log(`[AI] Iniciando análisis: ${documentId}`);
  console.log(`[AI] ================================`);

  try {
    // SKIP_COGNEE=true: saltar extracción de entidades, marcar como ANALYZED y disparar dictamen
    if (process.env.SKIP_COGNEE === 'true') {
      console.log(`[AI] SKIP_COGNEE activo — marcando ${documentId} como ANALYZED sin extracción`);
      await prisma.document.update({ where: { id: documentId }, data: { status: 'ANALYZED' } });
      await publishProgress(documentId, { step: '✓ Análisis completado (sin grafo)', percentage: 100, status: 'ANALYZED' });
      const { maybeScheduleAiDictamen } = await import('./ai-dictamen-service');
      maybeScheduleAiDictamen(documentId).catch(() => {});
      return { entitiesExtracted: 0 };
    }

    await updateProgress(documentId, 'Iniciando análisis de IA...', 60, { stage: 'ai_starting' });

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento ${documentId} no encontrado`);

    const indices = await prisma.pageIndex.findMany({
      where: { documentId }, orderBy: { level: 'asc' },
    });
    console.log(`[AI] ✓ ${indices.length} nodos de índice`);

    if (indices.length === 0) {
      await prisma.document.update({ where: { id: documentId }, data: { status: 'INDEXED' } });
      return { entitiesExtracted: 0 };
    }

    const fileSize = document.size || 0;
    const isLargeDocument = fileSize > 50 * 1024 * 1024;
    const companyId = document.userId;

    if (isLargeDocument) {
      await updateProgress(documentId, 'Procesando por lotes', 65, { stage: 'batch_processing' });
      const { analyzeChunksInBatch } = await import('./large-document-batch');

      const chunks = indices.map((idx, i) => ({
        id: idx.id, index: i, content: idx.content || '',
        startOffset: 0, endOffset: idx.content?.length || 0,
        metadata: { charCount: idx.content?.length || 0, page: idx.page || undefined },
      }));

      const result = await analyzeChunksInBatch(
        chunks, documentId, document.name,
        (progress) => {
          const pct = 65 + (progress.percentage * 0.3);
          updateProgress(documentId, `Chunks: ${progress.details?.chunksProcessed || 0}/${progress.details?.totalChunks || chunks.length}`, pct, {
            stage: 'batch_processing', ...progress.details,
          });
        },
        (document.domain?.toLowerCase() as CogneeDomain) || 'industria'
      );

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: result.totalEntities > 0 ? 'ANALYZED' : 'INDEXED',
          description: `${document.description || ''} | Entidades: ${result.totalEntities}, Relaciones: ${result.totalRelations}`,
        },
      });
      return { entitiesExtracted: result.totalEntities };
    }

    // Prefer actual Cognee Python service when available; fall back to TS reimplementation.
    const useCogneeService = cogneeClient.available && (await cogneeClient.isHealthy());
    console.log(`[AI] Cognee Python service: ${useCogneeService ? '✅ activo' : '⚠️  no disponible, usando TS fallback'}`);

    const { checkFalkorDBHealth, falkorDBService } = await import('./falkordb');
    const isHealthy = await checkFalkorDBHealth();
    console.log(`[AI] FalkorDB: ${isHealthy ? '✅' : '❌'}`);

    const validIndices = indices.filter(i => i.content && i.content.length > 50);
    const MAX_CHUNKS = parseInt(process.env.MAX_CHUNKS_TO_PROCESS || '500');
    // Cognee makes one LLM call per chunk in parallel — cap at 8 to stay under NIM rate limits
    const MAX_COGNEE_CHUNKS = parseInt(process.env.MAX_COGNEE_CHUNKS || '8');
    const toProcess = validIndices.slice(0, MAX_CHUNKS);
    const domain = (document.domain?.toLowerCase() as CogneeDomain) || 'industria';

    let entitiesInGraph = 0;
    let totalRelations = 0;

    if (useCogneeService) {
      // ── Path A: Cognee Python microservice ────────────────────────────────
      if (toProcess.length === 0) {
        console.log(`[AI] Sin chunks válidos para Cognee — marcando como INDEXED`);
        await prisma.document.update({ where: { id: documentId }, data: { status: 'INDEXED' } });
        return { entitiesExtracted: 0 };
      }

      const cogneeChunks = toProcess.slice(0, MAX_COGNEE_CHUNKS);
      console.log(`[AI] Enviando ${cogneeChunks.length} chunks a Cognee Python… (${toProcess.length} disponibles, cap=${MAX_COGNEE_CHUNKS})`);
      await updateProgress(documentId, 'Enviando chunks a Cognee', 62, { stage: 'cognee_add', chunks: cogneeChunks.length });

      await cogneeClient.addChunks(
        documentId,
        cogneeChunks.map(n => ({ title: n.title, content: n.content ?? '', page: n.page ?? undefined }))
      );

      await updateProgress(documentId, 'Construyendo grafo de conocimiento (Cognee)', 70, { stage: 'cognee_cognify' });
      console.log(`[AI] Iniciando cognify para ${documentId}…`);

      const cognifyResult = await cogneeClient.cognify(documentId);
      entitiesInGraph = cognifyResult.entities;
      console.log(`[AI] Cognee cognify completado: ${entitiesInGraph} entidades`);

    } else {
      // ── Path B: TS directo — DeepSeek V4 Pro batch extraction ─────────────
      // DeepSeek V4 Pro acepta hasta 1M tokens: se procesan BATCH_SIZE chunks
      // por llamada en lugar de 1 chunk/llamada. Reduce las llamadas ~20×.
      const BATCH_SIZE = Math.max(1, parseInt(process.env.DEEPSEEK_BATCH_SIZE || '20'));
      console.log(`[AI] DeepSeek batch: ${toProcess.length} nodos en lotes de ${BATCH_SIZE} | dominio: ${domain}`);

      let totalEntities = 0;
      let batchesProcessed = 0;
      const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        batchesProcessed++;

        const pct = 55 + ((batchesProcessed / totalBatches) * 40);
        await updateProgress(documentId, `Batch ${batchesProcessed}/${totalBatches} (${Math.min(i + BATCH_SIZE, toProcess.length)}/${toProcess.length} chunks)`, pct, {
          stage: 'deepseek_batch', batchesProcessed, totalBatches, chunksProcessed: Math.min(i + BATCH_SIZE, toProcess.length),
        });

        const chunkInputs = batch.map(node => ({
          id: node.id,
          title: node.title,
          content: node.content ?? '',
          page: node.page ?? undefined,
        }));

        const batchResults = await cogneeService.batchExtractKnowledge(
          chunkInputs, documentId, document.name, domain, companyId
        );

        // Persist each chunk's extracted graph in parallel (max 5 concurrent writes)
        const writeLimiter = new Bottleneck({ maxConcurrent: 5 });
        const writeSettled = await Promise.allSettled(
          batchResults.map((result) =>
            writeLimiter.schedule(async () => {
              if (result.entities.length === 0) return 0;
              const r = await cogneeService.persistToGraph(
                result.entities, result.relations, documentId, companyId
              );
              return r.saved;
            })
          )
        );

        for (const r of writeSettled) {
          if (r.status === 'fulfilled') totalEntities += r.value;
          else console.warn(`[AI] Write falló en batch ${batchesProcessed}:`, r.reason?.message);
        }

        console.log(`[AI] Batch ${batchesProcessed}/${totalBatches} completado | entidades acumuladas: ${totalEntities}`);
      }

      const stats = await falkorDBService.roQuery(
        'MATCH (n) WHERE n.documentId = $docId RETURN count(n) AS count',
        { docId: documentId }
      );
      entitiesInGraph = stats.rows[0]?.count || totalEntities;

      if (entitiesInGraph > 0 && companyId) {
        try {
          const linked = await falkorDBService.mergeSharedEntities(companyId);
          if (linked > 0) console.log(`[AI] ${linked} relaciones SAME_AS creadas`);
        } catch (err: any) {
          console.warn(`[AI] mergeSharedEntities falló (no crítico):`, err.message);
        }
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED',
        description: `${document.description || ''} | Entidades: ${entitiesInGraph}`,
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[AI] ✓ ANÁLISIS COMPLETADO EN ${duration}s | entidades: ${entitiesInGraph} | relaciones: ${totalRelations}`);
    await updateProgress(documentId, '✓ Análisis completado', 100, { stage: 'completed', duration });
    const finalStatus = entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED';
    await publishProgress(documentId, { step: '✓ Análisis completado', percentage: 100, status: finalStatus });

    // Disparar generación de dictamen IA si todos los docs de la empresa están listos
    const { maybeScheduleAiDictamen } = await import('./ai-dictamen-service');
    maybeScheduleAiDictamen(documentId).catch(() => {});

    return { entitiesExtracted: entitiesInGraph };

  } catch (error: any) {
    console.error(`[AI] ❌ ERROR:`, error.message);
    const isFalkorError = error.message.includes('FalkorDB') || error.message.includes('Redis');
    if (!isFalkorError) {
      await prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED' } });
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline completo síncrono (sin cola)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecuta indexación + análisis en secuencia sin pasar por la cola BullMQ.
 * Escape hatch para la ruta /api/documents/[id]/process y reprocesamiento manual.
 */
export async function runFullPipeline(
  documentId: string,
  domain?: CogneeDomain,
  extractionConfig?: ExtractionConfig
): Promise<ProcessResult> {
  const startTime = Date.now();

  try {
    if (domain) {
      await prisma.document.update({
        where: { id: documentId },
        data: { domain: domain.toUpperCase() as any },
      });
    }

    const { indicesCreated } = await runIndexing(documentId);
    const { entitiesExtracted } = await runAnalysis(documentId, extractionConfig);

    const doc = await prisma.document.findUnique({
      where: { id: documentId }, select: { status: true },
    });

    return {
      success: true,
      documentId,
      status: doc?.status,
      entities: entitiesExtracted,
      indices: indicesCreated,
      duration: ((Date.now() - startTime) / 1000).toFixed(2),
    };
  } catch (error: any) {
    console.error('[Pipeline] ❌ Error en runFullPipeline:', error.message);
    return { success: false, documentId, error: error.message };
  }
}
