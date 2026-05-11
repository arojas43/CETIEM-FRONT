import { Queue, Worker } from "bullmq";
import { prisma } from "../db";
import { runIndexing, runAnalysis } from "../document-pipeline";
import type { ExtractionConfig } from "../pipeline-types";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Redis = require("ioredis");

/**
 * Configuración de colas BullMQ para procesamiento de documentos
 */

// Configuración de conexión Redis
// maxRetriesPerRequest debe ser null para BullMQ (lo exige internamente)
const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
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
    removeOnComplete: { age: 3600 }, // Mantener 1h tras completar (TTL-based, no por conteo)
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
    removeOnComplete: { age: 3600 }, // Mantener 1h tras completar
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
  extractionConfig?: ExtractionConfig;
}

export interface AIAnalysisJob {
  documentId: string;
  userId?: string;         // Ownership validation: must match document.userId
  certificationId?: string;
  analysisType: "compliance" | "extraction" | "classification";
  extractionConfig?: ExtractionConfig;
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
        // Ownership validation: verificar que el documento pertenece al usuario que lo encoló
        const ownerCheck = await prisma.document.findUnique({
          where: { id: job.data.documentId },
          select: { userId: true },
        });
        if (!ownerCheck) {
          throw new Error(`Documento ${job.data.documentId} no encontrado`);
        }
        if (ownerCheck.userId !== job.data.userId) {
          throw new Error(`Unauthorized: documento ${job.data.documentId} no pertenece al usuario ${job.data.userId}`);
        }

        // Actualizar estado del documento
        await prisma.document.update({
          where: { id: job.data.documentId },
          data: { status: "PROCESSING" },
        });

        switch (job.data.type) {
          case "index": {
            await runIndexing(job.data.documentId);
            // Enqueue analysis after successful indexing
            try {
              await aiAnalysisQueue.add("ai-analysis", {
                documentId: job.data.documentId,
                userId: job.data.userId,
                analysisType: "extraction",
                ...(job.data.extractionConfig ? { extractionConfig: job.data.extractionConfig } : {}),
              });
            } catch (queueError: any) {
              console.warn(`[Worker] ⚠️ No se pudo encolar análisis: ${queueError.message}`);
            }
            break;
          }
          case "analyze":
            await runAnalysis(job.data.documentId, job.data.extractionConfig);
            break;
          case "certify":
            await processCertification(job.data.documentId);
            break;
          default:
            throw new Error(`Tipo de trabajo desconocido: ${job.data.type}`);
        }

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
        } else if (error.message.includes('OpenKB') || error.message.includes('Redis')) {
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
        error?.name === 'AbortError' ||       // NIM fetch timeout
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

      // Ownership validation
      if (job.data.userId) {
        const ownerCheck = await prisma.document.findUnique({
          where: { id: job.data.documentId },
          select: { userId: true },
        });
        if (ownerCheck && ownerCheck.userId !== job.data.userId) {
          throw new Error(`Unauthorized: documento ${job.data.documentId} no pertenece al usuario ${job.data.userId}`);
        }
      }

      if (job.data.analysisType === "extraction") {
        await runAnalysis(job.data.documentId, job.data.extractionConfig);
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
 * Procesa la certificación de un documento
 */
async function processCertification(documentId: string): Promise<void> {
  console.log(`[Certificación] Procesando: ${documentId}`);

  // Aquí iría la lógica de generación de certificación
  // basada en los análisis previos de PageIndex y OpenKB
}
