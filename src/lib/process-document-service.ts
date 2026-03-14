/**
 * Servicio de procesamiento de documentos
 * Ejecuta PageIndex + Cognee + FalkorDB
 */

import { prisma } from './db';
import { localStorageService } from './local-storage';
import { pageIndexService } from './pageindex-local';
import { cogneeService, type CogneeDomain } from './cognee-service';
import { checkFalkorDBHealth } from './falkordb';
import { checkRedisHealth } from './queue';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ProcessResult {
  success: boolean;
  documentId: string;
  status?: string;
  entities?: number;
  indices?: number;
  duration?: string;
  error?: string;
}

/** Escribe el progreso en la BD para que el polling de la UI lo muestre */
async function updateProgress(
  documentId: string,
  step: string,
  percentage: number,
  details: Record<string, any> = {}
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
  } catch {
    // No interrumpir el procesamiento si falla el progreso
  }
}

/**
 * Procesa un documento completo: PageIndex + Cognee
 */
export async function processDocument(documentId: string, domain?: CogneeDomain): Promise<ProcessResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Procesando documento: ${documentId}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Paso 0: Verificar servicios
    console.log('🔍 [0/6] Verificando servicios...');
    await updateProgress(documentId, 'Verificando servicios...', 3, { stage: 'init' });

    const [redisOk, falkorOk] = await Promise.all([
      checkRedisHealth(3),
      checkFalkorDBHealth(),
    ]);

    if (!redisOk) console.warn('⚠️  Redis no disponible');
    console.log(`   Redis: ${redisOk ? '✅' : '❌'} | FalkorDB: ${falkorOk ? '✅' : '❌'}`);

    // Paso 1: Obtener documento de BD
    console.log('\n📋 [1/6] Obteniendo documento de la base de datos...');
    await updateProgress(documentId, 'Cargando documento...', 5, { stage: 'init' });

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Documento ${documentId} no encontrado en la base de datos`);
    console.log(`   ✓ Documento: ${document.name}`);

    // Paso 2: Cargar PDF
    console.log('\n📁 [2/6] Cargando archivo PDF...');
    await updateProgress(documentId, 'Cargando PDF...', 8, { stage: 'init' });

    const metadata = await localStorageService.getMetadata(documentId);
    if (!metadata) throw new Error(`Metadatos no encontrados para ${documentId}`);

    const storagePath = process.env.LOCAL_STORAGE_PATH || './uploads';
    const pdfPath = join(storagePath, documentId, `${documentId}.pdf`);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = readFileSync(pdfPath);
      console.log(`   ✓ PDF cargado: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (error: any) {
      throw new Error(`Error leyendo PDF: ${error.message}`);
    }

    // Paso 3: Ejecutar PageIndex
    console.log('\n📊 [3/6] Ejecutando PageIndex (extracción de estructura)...');
    await updateProgress(documentId, 'Extrayendo estructura del PDF...', 12, {
      stage: 'pageindex',
      fileSize: pdfBuffer.length,
    });

    const pageIndexStartTime = Date.now();
    let pageIndex;
    try {
      pageIndex = await pageIndexService.buildIndex(documentId, pdfBuffer, document.name);
    } catch (error: any) {
      throw new Error(`Error en PageIndex: ${error.message}`);
    }

    const pageIndexDuration = ((Date.now() - pageIndexStartTime) / 1000).toFixed(2);
    console.log(`   ✓ PageIndex completado en ${pageIndexDuration}s`);

    // Paso 4: Guardar índices en PostgreSQL
    console.log('\n💾 [4/6] Guardando índices en PostgreSQL...');
    const nodes = pageIndexService.flattenNodes(pageIndex);
    await updateProgress(documentId, `Guardando ${nodes.length} índices...`, 38, {
      stage: 'pageindex',
      totalIndices: nodes.length,
    });

    const createdNodes = new Map<string, string>();
    for (const node of nodes) {
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
            metadata: {
              ...node.metadata,
              start_index: node.start_index,
              end_index: node.end_index,
              summary: node.summary,
              node_id: node.node_id,
              endPage: node.endPage,
            },
            parentId,
          },
        });
        createdNodes.set(node.id, created.id);
      } catch (error: any) {
        console.error(`   ⚠️  Error guardando nodo ${node.id}:`, error.message);
      }
    }

    console.log(`   ✓ Índices guardados: ${createdNodes.size}/${nodes.length} nodos`);
    await updateProgress(documentId, 'Estructura indexada', 45, {
      stage: 'pageindex',
      totalIndices: createdNodes.size,
    });

    await prisma.document.update({ where: { id: documentId }, data: { status: 'INDEXED' } });
    console.log('   ✓ Estado actualizado: INDEXED');

    // Paso 5: Ejecutar Cognee (análisis de IA)
    console.log('\n🧠 [5/6] Ejecutando Cognee (extracción de conocimiento)...');
    const cogneeStartTime = Date.now();

    const indices = await prisma.pageIndex.findMany({
      where: { documentId },
      orderBy: { level: 'asc' },
    });
    console.log(`   - Obtenidos ${indices.length} nodos de índice`);

    // Procesar por nodo (preserva referencia de página por entidad)
    const validIndices = indices.filter(i => i.content && i.content.length > 50);
    const MAX_CHUNKS = parseInt(process.env.MAX_CHUNKS_TO_PROCESS || '500');
    const indicesToProcess = validIndices.slice(0, MAX_CHUNKS);

    console.log(`   - Procesando ${indicesToProcess.length}/${validIndices.length} nodos (límite: ${MAX_CHUNKS})`);
    console.log(`   - Dominio: ${domain || 'legal (default)'}`);

    let totalEntities = 0;
    let totalRelations = 0;
    // Actualizar progreso cada 5 chunks (evitar saturar la BD)
    const PROGRESS_INTERVAL = 5;

    for (let i = 0; i < indicesToProcess.length; i++) {
      const indexNode = indicesToProcess[i];
      const chunk = `${indexNode.title}: ${indexNode.content?.slice(0, 2000) || ''}`;

      process.stdout.write(`   - Procesando chunk ${i + 1}/${indicesToProcess.length}...\r`);

      // Actualizar progreso en la BD periódicamente (45% → 95%)
      if (i % PROGRESS_INTERVAL === 0) {
        const cogneePercent = 45 + Math.round((i / indicesToProcess.length) * 50);
        await updateProgress(documentId, `Analizando chunk ${i + 1}/${indicesToProcess.length}`, cogneePercent, {
          stage: 'cognee',
          chunksProcessed: i,
          totalChunks: indicesToProcess.length,
          entitiesExtracted: totalEntities,
        });
      }

      const pageIndexReference = {
        page: indexNode.page ?? undefined,
        section: indexNode.title,
        start_index: (indexNode.metadata as any)?.start_index,
        end_index: (indexNode.metadata as any)?.end_index,
      };

      try {
        const { entities, relations } = await cogneeService.extractKnowledge(
          chunk,
          documentId,
          document.name,
          domain,
          pageIndexReference
        );

        if (entities.length > 0) {
          const result = await cogneeService.persistToGraph(entities, relations, documentId);
          totalEntities += result.saved;
          totalRelations += relations.length - result.failed;
        }
      } catch (error: any) {
        console.warn(`     Error en chunk ${i + 1}:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const cogneeDuration = ((Date.now() - cogneeStartTime) / 1000).toFixed(2);
    console.log(`\n   ✓ Cognee completado en ${cogneeDuration}s`);
    console.log(`   ✓ Entidades extraídas: ${totalEntities}`);
    console.log(`   ✓ Relaciones extraídas: ${totalRelations}`);

    // Paso 6: Finalizar
    console.log('\n✅ [6/6] Finalizando procesamiento...');
    await updateProgress(documentId, 'Verificando grafo...', 97, { stage: 'cognee' });

    const { falkorDBService } = await import('./falkordb');
    const graphStats = await falkorDBService.roQuery(
      `MATCH (n) WHERE n.documentId = "${documentId}" RETURN count(n) AS count`
    );
    const entitiesInGraph = graphStats.rows[0]?.count || 0;
    const finalStatus = entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED';
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: finalStatus,
        description: `${document.description || ''} | Entidades: ${entitiesInGraph}`.trim(),
        processingProgress: {
          step: 'Completado',
          percentage: 100,
          details: {
            stage: 'done',
            totalIndices: createdNodes.size,
            totalChunks: indicesToProcess.length,
            entitiesExtracted: entitiesInGraph,
            duration: totalDuration,
          },
          updatedAt: new Date().toISOString(),
        },
      },
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESAMIENTO COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`⏱️  Tiempo total: ${totalDuration}s`);
    console.log(`📊 Estado final: ${finalStatus}`);
    console.log(`🧠 Entidades en grafo: ${entitiesInGraph}`);
    console.log(`📑 Índices creados: ${createdNodes.size}`);
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      documentId,
      status: finalStatus,
      entities: entitiesInGraph,
      indices: createdNodes.size,
      duration: totalDuration,
    };

  } catch (error: any) {
    console.error('\n❌ ERROR en procesamiento:', error.message);
    console.error(error.stack);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        description: error.message.slice(0, 200),
        processingProgress: {
          step: `Error: ${error.message.slice(0, 80)}`,
          percentage: 0,
          details: { stage: 'error' },
          updatedAt: new Date().toISOString(),
        },
      },
    });

    return { success: false, documentId, error: error.message };
  }
}
