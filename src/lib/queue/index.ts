import { Queue, Worker } from "bullmq";
import { prisma } from "../db";
import { storageService } from "../storage";
import { pageIndexService } from "../pageindex";
import { cogneeService } from "../cognee-service";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Redis = require("ioredis");

/**
 * Configuración de colas BullMQ para procesamiento de documentos
 */

// Configuración de conexión Redis
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
};

/**
 * Verifica que Redis esté disponible antes de iniciar workers
 */
export async function checkRedisHealth(maxRetries: number = 5): Promise<boolean> {
  let client;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = new Redis({
        host: redisConnection.host,
        port: redisConnection.port,
        lazyConnect: true,
        connectionTimeout: 3000,
        maxRetriesPerRequest: 1,
      });

      await client.connect();
      const pong = await client.ping();

      if (pong === 'PONG') {
        await client.quit();
        console.log(`✅ Redis disponible en ${redisConnection.host}:${redisConnection.port}`);
        return true;
      }
    } catch (error: any) {
      console.warn(`[Redis Health] Intento ${attempt}/${maxRetries} fallido:`, error.message);
      if (client) {
        try { await client.quit(); } catch { }
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
  }

  console.error(`❌ Redis no disponible después de ${maxRetries} intentos`);
  return false;
}

// Cola de procesamiento de documentos
export const documentProcessingQueue = new Queue("document-processing", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Cola de análisis de IA
export const aiAnalysisQueue = new Queue("ai-analysis", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 500,
    attempts: 2,
  },
});

// Cola de generación de reportes
export const reportGenerationQueue = new Queue("report-generation", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 100,
  },
});

// Tipos de trabajos
export interface DocumentProcessingJob {
  documentId: string;
  userId: string;
  type: "index" | "analyze" | "certify";
}

export interface AIAnalysisJob {
  documentId: string;
  certificationId?: string;
  analysisType: "compliance" | "extraction" | "classification";
}

export interface ReportGenerationJob {
  certificationId: string;
  format: "pdf" | "json" | "html";
}

/**
 * Worker para procesamiento de documentos con manejo robusto de errores
 */
export async function createDocumentProcessingWorker() {
  const worker = new Worker<DocumentProcessingJob, any>(
    "document-processing",
    async (job) => {
      const startTime = Date.now();
      console.log(`[Worker] Procesando documento ${job.data.documentId} - Tipo: ${job.data.type}`);

      try {
        // Actualizar estado del documento
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: { status: "PROCESSING" },
        });

        switch (job.data.type) {
          case "index":
            await processDocumentIndexing(job.data.documentId);
            // El estado lo gestiona processDocumentIndexing internamente
            break;
          case "analyze":
            await processDocumentAnalysis(job.data.documentId);
            // El estado (ANALYZED/INDEXED) lo gestiona processDocumentAnalysis internamente
            // No sobreescribir aquí para no perder el estado ANALYZED
            return { success: true, documentId: job.data.documentId, duration: ((Date.now() - startTime) / 1000).toFixed(2) };
          case "certify":
            await processCertification(job.data.documentId);
            break;
          default:
            throw new Error(`Tipo de trabajo desconocido: ${job.data.type}`);
        }

        // Actualizar estado a completado solo para jobs de tipo "index" y "certify"
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: { status: "INDEXED" },
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[Worker] ✓ Trabajo completado en ${duration}s: ${job.data.documentId}`);

        return { success: true, documentId: job.data.documentId, duration };
      } catch (error: any) {
        console.error(`[Worker] ❌ Error procesando documento ${job.data.documentId}:`, error.message);

        // Clasificar el error para mejor manejo
        let errorMessage = error.message;
        let errorType = 'UNKNOWN';

        if (error.message.includes('PDF no encontrado')) {
          errorType = 'FILE_NOT_FOUND';
        } else if (error.message.includes('Metadatos no encontrados')) {
          errorType = 'METADATA_NOT_FOUND';
        } else if (error.message.includes('NIM') || error.message.includes('NVIDIA')) {
          errorType = 'AI_SERVICE_ERROR';
        } else if (error.message.includes('FalkorDB') || error.message.includes('Redis')) {
          errorType = 'DATABASE_ERROR';
        }

        // Actualizar estado con información del error
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: {
            status: "FAILED",
            description: `Error (${errorType}): ${errorMessage.slice(0, 200)}`
          },
        });

        // Lanzar error para que BullMQ lo registre como fallido
        throw new Error(`[${errorType}] ${errorMessage}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[Worker] ✅ Trabajo ${job?.id} completado:`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker] ❌ Trabajo ${job?.id} falló:`, error?.message || error);

    // Reintentar automáticamente errores transitorios
    if (job?.attemptsMade && job.attemptsMade < 3) {
      const isTransientError =
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('Redis');

      if (isTransientError) {
        console.log(`[Worker] Error transitorio, reintentando... (${job.attemptsMade}/3)`);
      }
    }
  });

  worker.on("error", (error) => {
    console.error('[Worker] Error crítico en worker:', error);
  });

  return worker;
}

/**
 * Worker para análisis de IA
 */
export async function createAIAnalysisWorker() {
  const worker = new Worker<AIAnalysisJob, any>(
    "ai-analysis",
    async (job) => {
      console.log(`[AI Worker] Análisis: ${job.data.analysisType} para documento ${job.data.documentId}`);

      // Ejecutar el análisis correspondiente
      if (job.data.analysisType === "extraction") {
        await processDocumentAnalysis(job.data.documentId);
      } else {
        console.warn(`[AI Worker] Tipo de análisis desconocido: ${job.data.analysisType}`);
      }

      return { success: true, analysisType: job.data.analysisType };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  return worker;
}

/**
 * Worker para generación de reportes
 */
export async function createReportGenerationWorker() {
  const worker = new Worker<ReportGenerationJob, any>(
    "report-generation",
    async (job) => {
      console.log(`[Report Worker] Generando reporte ${job.data.format} para certificación ${job.data.certificationId}`);

      return { success: true, format: job.data.format };
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  return worker;
}

/**
 * Actualiza el progreso de procesamiento de un documento
 */
async function updateProgress(
  documentId: string,
  step: string,
  percentage: number,
  details: Record<string, any>
): Promise<void> {
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        processingProgress: {
          step,
          percentage: Math.min(percentage, 100),
          details,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error: any) {
    console.error(`[Progress] Error actualizando progreso:`, error.message);
    // No lanzar error para no interrumpir el procesamiento
  }
}

/**
 * Procesa la indexación de un documento con PageIndex y manejo robusto de errores
 * Soporta documentos grandes (hasta 2GB) con streaming y chunking
 */
async function processDocumentIndexing(documentId: string): Promise<void> {
  const startTime = Date.now();
  console.log(`[PageIndex] Indexando documento: ${documentId}`);

  try {
    // Reportar progreso: Iniciando
    await updateProgress(documentId, "Iniciando PageIndex", 5, { stage: "initializing" });

    // Obtener documento de la BD
    console.log(`[PageIndex] [1/8] Obteniendo documento...`);
    await updateProgress(documentId, "Obteniendo documento", 10, { stage: "fetching" });

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Documento ${documentId} no encontrado en la base de datos`);
    }
    console.log(`[PageIndex] ✓ Documento encontrado: ${document.name}`);

    // Obtener metadatos del almacenamiento local
    console.log(`[PageIndex] [2/8] Obteniendo metadatos...`);
    await updateProgress(documentId, "Cargando metadatos", 15, { stage: "metadata" });

    const { localStorageService } = await import('../local-storage');
    const metadata = await localStorageService.getMetadata(documentId);

    if (!metadata) {
      throw new Error(`Metadatos no encontrados para ${documentId}`);
    }
    console.log(`[PageIndex] ✓ Metadatos encontrados`);

    // Verificar tamaño del archivo para determinar estrategia
    const fileSize = document.size || 0;
    const isLargeDocument = fileSize > 50 * 1024 * 1024; // > 50MB
    console.log(`[PageIndex] Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB, Grande: ${isLargeDocument}`);
    await updateProgress(documentId, `Analizando PDF (${(fileSize / 1024 / 1024).toFixed(1)}MB)`, 20, {
      stage: "analyzing",
      fileSize,
      isLargeDocument,
    });

    // Leer archivo PDF (streaming para grandes)
    console.log(`[PageIndex] [3/8] Leyendo archivo PDF...`);
    const fs = await import('fs');
    const path = await import('path');

    const pdfPath = path.join(process.env.LOCAL_STORAGE_PATH || './uploads', documentId, `${documentId}.pdf`);

    if (!fs.default.existsSync(pdfPath)) {
      throw new Error(`Archivo PDF no encontrado en: ${pdfPath}`);
    }

    let pdfBuffer: Buffer;
    if (isLargeDocument) {
      console.log(`[PageIndex] Usando pdftotext para documento grande (>50MB)`);
      await updateProgress(documentId, "Extrayendo texto (documento grande)", 30, { stage: "extracting_large" });

      // Para documentos MUY grandes, usar pdftotext (poppler) con streaming real
      const { extractTextFromPDFWithPdftotext } = await import('../large-document-pdftotext');

      const result = await extractTextFromPDFWithPdftotext(pdfPath, fileSize, (progress) => {
        const currentProgress = 30 + (progress.percentage * 0.2); // 30-50%
        updateProgress(documentId, `Extrayendo texto: ${progress.percentage.toFixed(0)}%`, currentProgress, {
          stage: "extracting",
          extractionProgress: progress,
        });
      });

      // Verificar si se extrajo texto
      if (!result || result.totalPages === 0 || result.chunks.length === 0) {
        console.warn(`[PageIndex] ⚠️  No se pudo extraer texto del PDF`);
        // Crear al menos un nodo vacío para indicar que se intentó
        await prisma.pageIndex.create({
          data: {
            documentId,
            level: 0,
            title: 'Error en extracción',
            content: 'No se pudo extraer texto del PDF. Puede estar corrupto o protegido.',
            page: 0,
            metadata: { error: true, fileSize },
            parentId: null,
          },
        });

        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'FAILED', description: 'Error: No se pudo extraer texto del PDF' },
        });
        return;
      }

      // Guardar texto extraído para siguiente paso
      await prisma.document.update({
        where: { id: documentId },
        data: {
          description: `Texto extraído: ${result.text.length} caracteres, ~${result.totalPages} páginas, ${result.chunks.length} chunks`,
        },
      });

      // Crear índices desde chunks
      console.log(`[PageIndex] [4/8] Creando índices desde ${result.chunks.length} chunks...`);
      const nodes = result.chunks.map((chunk, index) => ({
        id: chunk.id,
        level: 1,
        title: `Sección ${index + 1}`,
        content: chunk.content.slice(0, 10000),
        page: Math.floor(index / 10) + 1, // Página estimada
        metadata: {
          chunkIndex: chunk.index,
          charCount: chunk.metadata.charCount,
          streaming: true,
          method: 'pdftotext',
        },
        parentId: null,
      }));

      // Guardar nodos en lotes para no saturar
      const createdNodes = new Map<string, string>();
      const batchSize = 50;

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        console.log(`[PageIndex] Guardando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(nodes.length / batchSize)} (${batch.length} nodos)`);

        for (const node of batch) {
          try {
            const created = await prisma.pageIndex.create({
              data: {
                documentId,
                level: node.level,
                title: node.title,
                content: node.content,
                page: node.page,
                metadata: node.metadata,
                parentId: node.parentId,
              },
            });
            createdNodes.set(node.id, created.id);
          } catch (error: any) {
            console.error(`[PageIndex] Error guardando nodo ${node.id}:`, error.message);
          }
        }

        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[PageIndex] ✓ Índice guardado: ${createdNodes.size}/${nodes.length} nodos`);
    } else {
      // Documento pequeño - método tradicional
      const pdfBufferTraditional = fs.default.readFileSync(pdfPath);
      console.log(`[PageIndex] ✓ PDF leído: ${(pdfBufferTraditional.length / 1024 / 1024).toFixed(2)} MB`);

      // Construir índice con PageIndex
      console.log(`[PageIndex] [4/8] Extrayendo texto y estructura...`);
      await updateProgress(documentId, "Extrayendo estructura", 40, { stage: "extracting_structure" });

      let pageIndex;
      try {
        pageIndex = await pageIndexService.buildIndex(
          documentId,
          pdfBufferTraditional,
          document.name
        );
      } catch (error: any) {
        throw new Error(`Error en PageIndex: ${error.message}`);
      }

      console.log(`[PageIndex] ✓ Índice construido`);
      await updateProgress(documentId, "Índice construido", 45, { stage: "index_built" });

      // Guardar nodos del índice en la BD
      console.log(`[PageIndex] [5/8] Guardando índices en PostgreSQL...`);
      await updateProgress(documentId, "Guardando índices", 48, { stage: "saving_indices" });

      const nodes = pageIndexService.flattenNodes(pageIndex);
      const createdNodes = new Map<string, string>();

      const batchSize = 50;
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const currentProgress = 48 + ((i / nodes.length) * 2); // 48-50%

        await updateProgress(documentId, `Guardando índices: ${Math.min(i + batchSize, nodes.length)}/${nodes.length}`, currentProgress, {
          stage: "saving",
          saved: i,
          total: nodes.length,
        });

        for (const node of batch) {
          try {
            const parentId = node.parentId && node.level > 0
              ? createdNodes.get(node.parentId) || null
              : null;

            const created = await prisma.pageIndex.create({
              data: {
                documentId,
                level: node.level,
                title: node.title,
                content: node.content?.slice(0, 10000) || '',
                page: node.page,
                metadata: { ...((node.metadata as object) || {}), endPage: node.endPage },
                parentId: parentId,
              },
            });

            createdNodes.set(node.id, created.id);
          } catch (error: any) {
            console.error(`[PageIndex] Error guardando nodo ${node.id}:`, error.message);
          }
        }

        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[PageIndex] ✓ Índice guardado: ${createdNodes.size}/${nodes.length} nodos`);
      await updateProgress(documentId, `Índices guardados: ${createdNodes.size}`, 50, {
        stage: "indices_saved",
        totalIndices: createdNodes.size,
      });
    }

    // Encolar análisis con Cognee
    console.log(`[PageIndex] [6/8] Encolando análisis con Cognee...`);
    await updateProgress(documentId, "Preparando análisis de IA...", 52, { stage: "queueing_analysis" });

    try {
      const { aiAnalysisQueue } = await import('../queue');
      await aiAnalysisQueue.add("ai-analysis", {
        documentId,
        analysisType: "extraction",
      });
      console.log(`[PageIndex] ✓ Análisis encolado correctamente`);
    } catch (queueError: any) {
      console.warn(`[PageIndex] ⚠️  No se pudo encolar análisis: ${queueError.message}`);
      console.warn(`[PageIndex] El análisis se podrá ejecutar manualmente más tarde`);
    }

    // Actualizar estado
    console.log(`[PageIndex] [7/8] Actualizando estado...`);
    await updateProgress(documentId, "Completando indexación", 55, { stage: "finalizing" });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "INDEXED" },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[PageIndex] ✅ Indexación completada en ${duration}s`);
    await updateProgress(documentId, "✓ Indexación completada", 100, {
      stage: "completed",
      duration,
      nextStep: "Análisis Cognee",
    });
  } catch (error: any) {
    console.error(`[PageIndex] ❌ Error en indexación:`, error.message);

    // Actualizar estado a FAILED
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });

    throw error;
  }
}

/**
 * Procesa el análisis de un documento con Cognee y manejo robusto de errores
 * Soporta documentos grandes con análisis por lotes de chunks
 */
async function processDocumentAnalysis(documentId: string): Promise<void> {
  const startTime = Date.now();
  console.log(`\n\n[AI Worker] ====================================`);
  console.log(`[AI Worker] Iniciando análisis: ${documentId}`);
  console.log(`[AI Worker] ====================================`);

  try {
    // Reportar progreso: Iniciando Cognee
    await updateProgress(documentId, "Iniciando análisis de IA...", 60, { stage: "ai_starting" });

    // Obtener documento
    console.log(`[AI Worker] [1/8] Obteniendo documento de BD...`);
    await updateProgress(documentId, "Obteniendo documento", 62, { stage: "cognee_fetching" });

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Documento ${documentId} no encontrado`);
    }
    console.log(`[AI Worker] ✓ Documento encontrado: ${document.name}`);

    // Obtener contenido del índice
    console.log(`[AI Worker] [2/8] Obteniendo índices de PageIndex...`);
    const indices = await prisma.pageIndex.findMany({
      where: { documentId },
      orderBy: { level: "asc" },
    });

    console.log(`[AI Worker] ✓ Obtenidos ${indices.length} nodos de índice`);

    if (indices.length === 0) {
      console.warn(`[AI Worker] ⚠️  No hay índices para este documento`);
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "INDEXED" },
      });
      return;
    }

    // Determinar si es documento grande
    const fileSize = document.size || 0;
    const isLargeDocument = fileSize > 50 * 1024 * 1024;
    console.log(`[AI Worker] Tamaño: ${(fileSize / 1024 / 1024).toFixed(2)}MB, Grande: ${isLargeDocument}`);

    if (isLargeDocument) {
      // Documento grande: usar procesamiento por lotes
      console.log(`[AI Worker] [3/8] Usando procesamiento por lotes para documento grande...`);
      await updateProgress(documentId, "Procesando por lotes", 65, { stage: "batch_processing" });

      const { analyzeChunksInBatch } = await import('../large-document-batch');

      // Convertir índices a chunks
      const chunks = indices.map((index, idx) => ({
        id: index.id,
        index: idx,
        content: index.content || '',
        startOffset: 0,
        endOffset: index.content?.length || 0,
        metadata: {
          charCount: index.content?.length || 0,
          page: index.page || undefined,
        },
      }));

      console.log(`[AI Worker] Procesando ${chunks.length} chunks en lotes...`);

      // Callback de progreso para analyzeChunksInBatch
      const onProgress = (progress: any) => {
        const currentProgress = 65 + (progress.percentage * 0.3); // 65-95%
        updateProgress(documentId, `Procesando chunks: ${progress.details?.chunksProcessed || 0}/${progress.details?.totalChunks || chunks.length}`, currentProgress, {
          stage: "batch_processing",
          chunksProcessed: progress.details?.chunksProcessed,
          totalChunks: progress.details?.totalChunks,
          entitiesExtracted: progress.details?.entitiesExtracted,
        });
      };

      const result = await analyzeChunksInBatch(
        chunks,
        documentId,
        document.name,
        onProgress,
        (document.domain?.toLowerCase() as any) || 'industria'
      );

      console.log(`[AI Worker] ✓ Lotes completados: ${result.chunksProcessed}`);
      console.log(`[AI Worker] ✓ Entidades: ${result.totalEntities}, Relaciones: ${result.totalRelations}`);

      // Actualizar estado
      console.log(`[AI Worker] [4/4] Actualizando estado...`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: result.totalEntities > 0 ? "ANALYZED" : "INDEXED",
          description: `${document.description || ''} | Entidades: ${result.totalEntities}, Relaciones: ${result.totalRelations}`,
        },
      });

    } else {
      // Documento pequeño: procesar cada nodo PageIndex como chunk independiente
      // Esto preserva la referencia de página/sección por entidad extraída
      console.log(`[AI Worker] [3/8] Procesando ${indices.length} nodos PageIndex...`);

      // Inicializar FalkorDB
      console.log(`[AI Worker] [4/8] Verificando conexión con FalkorDB...`);
      const { checkFalkorDBHealth } = await import('../falkordb');
      const isHealthy = await checkFalkorDBHealth();
      console.log(`[AI Worker] FalkorDB: ${isHealthy ? '✅ Disponible' : '❌ No disponible'}`);

      // Filtrar nodos con contenido suficiente
      const validIndices = indices.filter(i => i.content && i.content.length > 50);
      if (validIndices.length === 0) {
        console.warn(`[AI Worker] ⚠️  Sin contenido suficiente en índices`);
      }

      // Procesar con Cognee - Extraer conocimiento del contenido
      console.log(`[AI Worker] [5/8] Extrayendo conocimiento con Cognee...`);
      console.log(`[AI Worker]   - Analizando ${validIndices.length} nodos...`);

      let totalEntities = 0;
      let totalRelations = 0;

      const MAX_CHUNKS_TO_PROCESS = parseInt(process.env.MAX_CHUNKS_TO_PROCESS || '500');
      // [Mejora 3] micro-batches paralelos — configurable con COGNEE_PARALLEL_CHUNKS
      const PARALLEL_CHUNKS = Math.max(1, parseInt(process.env.COGNEE_PARALLEL_CHUNKS || '5'));
      const indicesToProcess = validIndices.slice(0, MAX_CHUNKS_TO_PROCESS);
      // companyId = userId del propietario del documento (para grafo global cross-doc)
      const companyId = document.userId;

      console.log(`[AI Worker]   - Procesando ${indicesToProcess.length}/${validIndices.length} nodos (límite: ${MAX_CHUNKS_TO_PROCESS})`);
      console.log(`[AI Worker]   - Paralelismo: ${PARALLEL_CHUNKS} chunks simultáneos`);
      console.log(`[AI Worker]   - Dominio: ${(document.domain?.toLowerCase()) || 'industria (default)'}`);
      console.log(`[AI Worker]   - companyId: ${companyId}`);

      // Procesar en micro-batches paralelos
      for (let batchStart = 0; batchStart < indicesToProcess.length; batchStart += PARALLEL_CHUNKS) {
        const batchSlice = indicesToProcess.slice(batchStart, batchStart + PARALLEL_CHUNKS);
        const batchNum = Math.floor(batchStart / PARALLEL_CHUNKS) + 1;
        const totalBatches = Math.ceil(indicesToProcess.length / PARALLEL_CHUNKS);

        console.log(`[AI Worker]   - Batch ${batchNum}/${totalBatches} (chunks ${batchStart + 1}-${Math.min(batchStart + PARALLEL_CHUNKS, indicesToProcess.length)})`);

        // Actualizar progreso una vez por batch (no por chunk)
        const batchProgress = 55 + ((batchStart / indicesToProcess.length) * 35); // 55-90%
        await updateProgress(documentId, `Procesando batch ${batchNum}/${totalBatches}`, batchProgress, {
          stage: 'cognee_parallel',
          batch: batchNum,
          totalBatches,
          chunksProcessed: batchStart,
          totalChunks: indicesToProcess.length,
        });

        // Ejecutar el batch en paralelo con tolerancia a fallos
        const batchResults = await Promise.allSettled(
          batchSlice.map(async (indexNode) => {
            const chunk = `${indexNode.title}: ${indexNode.content?.slice(0, 2000) || ''}`;
            const pageIndexReference = {
              page: indexNode.page ?? undefined,
              section: indexNode.title,
              start_index: (indexNode.metadata as any)?.start_index,
              end_index: (indexNode.metadata as any)?.end_index,
            };

            const { entities, relations } = await cogneeService.extractKnowledge(
              chunk,
              documentId,
              document.name,
              (document.domain?.toLowerCase() as any) || 'industria',
              pageIndexReference,
              undefined, // extractionConfig
              companyId  // [Mejora 2] propaga companyId al grafo
            );

            if (entities.length > 0) {
              const result = await cogneeService.persistToGraph(entities, relations, documentId, companyId);
              return { entities: result.saved, relations: relations.length - result.failed };
            }
            return { entities: 0, relations: 0 };
          })
        );

        // Acumular resultados del batch
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            totalEntities += result.value.entities;
            totalRelations += result.value.relations;
          } else {
            console.warn(`[AI Worker]   • Chunk falló en batch ${batchNum}:`, result.reason?.message);
          }
        }

        // Pequeña pausa entre batches para no saturar la NIM API
        if (batchStart + PARALLEL_CHUNKS < indicesToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`[AI Worker] ✓ Cognee completó procesamiento`);
      console.log(`[AI Worker]   - Entidades extraídas: ${totalEntities}`);
      console.log(`[AI Worker]   - Relaciones extraídas: ${totalRelations}`);

      if (totalEntities > 0) {
        console.log(`[AI Worker]   - Grafo actualizado en FalkorDB`);
      }

      // Verificar si se guardó en FalkorDB
      console.log(`[AI Worker] [6/8] Verificando persistencia...`);
      const { falkorDBService } = await import('../falkordb');
      const graphStats = await falkorDBService.roQuery(
        "MATCH (n) WHERE n.documentId = $docId RETURN count(n) AS count",
        { docId: documentId }
      );
      const entitiesInGraph = graphStats.rows[0]?.count || 0;
      console.log(`[AI Worker]   - Entidades en grafo: ${entitiesInGraph}`);

      // Actualizar estado del documento
      console.log(`[AI Worker] [7/8] Actualizando estado del documento...`);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: entitiesInGraph > 0 ? "ANALYZED" : "INDEXED",
          description: `${document.description || ''} | Entidades: ${entitiesInGraph}`,
        },
      });

      // [Mejora 2] Reenlazar entidades compartidas del grafo global de la empresa
      if (entitiesInGraph > 0 && companyId) {
        console.log(`[AI Worker] [7b/8] Vinculando entidades cross-documento (SAME_AS)...`);
        try {
          const linked = await falkorDBService.mergeSharedEntities(companyId);
          if (linked > 0) {
            console.log(`[AI Worker]   - ${linked} relaciones SAME_AS creadas en grafo global`);
          }
        } catch (mergeError: any) {
          console.warn(`[AI Worker]   ⚠️ mergeSharedEntities falló (no crítico):`, mergeError.message);
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[AI Worker] [8/8] Análisis completado en ${duration}s`);
    console.log(`[AI Worker] ====================================`);
    console.log(`[AI Worker] ✓ ANÁLISIS COMPLETADO EN ${duration}s`);
    console.log(`[AI Worker] ====================================\n\n`);
    await updateProgress(documentId, "✓ Análisis completado", 100, {
      stage: "completed",
      duration,
    });

  } catch (error: any) {
    console.error(`[AI Worker] ❌ ERROR en processDocumentAnalysis:`, error.message);
    console.error(`[AI Worker] Stack:`, error.stack);

    // No marcar como FAILED si es solo error de FalkorDB
    const isFalkorDBError = error.message.includes('FalkorDB') || error.message.includes('Redis');

    if (!isFalkorDBError) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED" },
      });
    }

    throw error;
  }
}

/**
 * Procesa la certificación de un documento
 */
async function processCertification(documentId: string): Promise<void> {
  console.log(`[Certificación] Procesando: ${documentId}`);

  // Aquí iría la lógica de generación de certificación
  // basada en los análisis previos de PageIndex y Cognee
}
