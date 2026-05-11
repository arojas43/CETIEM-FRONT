/**
 * Pipeline de procesamiento de documentos — fuente única de verdad.
 *
 * Expone tres funciones públicas:
 *   runIndexing     → Phase 1: PDF → PageIndex → PostgreSQL
 *   runAnalysis     → Phase 2: marca ANALYZED y dispara dictamen IA
 *   runFullPipeline → Ambas fases en secuencia, sin cola (escape hatch síncrono)
 *
 * Los workers de BullMQ (queue/index.ts) llaman a runIndexing / runAnalysis.
 * La ruta /api/documents/[id]/process llama a runFullPipeline.
 */

import { prisma } from './db';
import { storageService } from './storage';
import { pageIndexService } from './pageindex';
import type { CogneeDomain, ExtractionConfig } from './pipeline-types';
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
// Phase 2: Análisis IA — marca ANALYZED y dispara dictamen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Indexa el contenido de PageIndex en OpenKB (si está disponible) y marca ANALYZED.
 * OpenKB construye un KB wiki-style que luego sirve como backend de búsqueda.
 */
export async function runAnalysis(
  documentId: string,
  _extractionConfig?: ExtractionConfig
): Promise<{ entitiesExtracted: number }> {
  console.log(`[AI] Iniciando análisis: ${documentId}`);
  try {
    await updateProgress(documentId, 'Indexando en OpenKB...', 65, { stage: 'openkb_indexing' });

    // Indexar en OpenKB (KB por empresa para razonamiento cross-documento).
    // Si OpenKB no está disponible o falla, continúa sin bloquear el pipeline.
    try {
      const { openKBClient } = await import('./openkb-client');
      if (await openKBClient.isHealthy()) {
        const doc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { userId: true, name: true },
        });
        const companyId = doc?.userId ?? documentId;

        const nodes = await prisma.pageIndex.findMany({
          where: { documentId },
          orderBy: [{ level: 'asc' }, { page: 'asc' }],
          select: { title: true, content: true, page: true },
        });

        if (nodes.length > 0) {
          const docHeader = `# ${doc?.name ?? documentId}\n\n`;
          const body = nodes
            .filter(n => n.content && n.content.length > 20)
            .map(n => `## ${n.title}${n.page ? ` (p.${n.page})` : ''}\n${n.content}`)
            .join('\n\n');
          await openKBClient.addDocument(companyId, documentId, docHeader + body);
          console.log(`[AI] ✓ OpenKB indexado: ${nodes.length} secciones → KB empresa ${companyId}`);
        }
      } else {
        console.log(`[AI] OpenKB no disponible — continuando sin indexar`);
      }
    } catch (err: any) {
      console.warn(`[AI] OpenKB indexing falló (no crítico):`, err.message);
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: 'ANALYZED' } });
    await publishProgress(documentId, { step: '✓ Análisis completado', percentage: 100, status: 'ANALYZED' });
    const { maybeScheduleAiDictamen } = await import('./ai-dictamen-service');
    maybeScheduleAiDictamen(documentId).catch(() => {});
    return { entitiesExtracted: 0 };
  } catch (error: any) {
    console.error(`[AI] ❌ ERROR:`, error.message);
    await prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED' } });
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
