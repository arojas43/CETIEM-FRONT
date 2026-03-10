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
    const [redisOk, falkorOk] = await Promise.all([
      checkRedisHealth(3),
      checkFalkorDBHealth(),
    ]);
    
    if (!redisOk) {
      console.warn('⚠️  Redis no disponible, se saltará el encolado');
    }
    console.log(`   Redis: ${redisOk ? '✅' : '❌'} | FalkorDB: ${falkorOk ? '✅' : '❌'}`);

    // Paso 1: Obtener documento de BD
    console.log('\n📋 [1/6] Obteniendo documento de la base de datos...');
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Documento ${documentId} no encontrado en la base de datos`);
    }
    console.log(`   ✓ Documento: ${document.name}`);
    console.log(`   ✓ Estado actual: ${document.status}`);

    // Paso 2: Obtener metadatos y archivo PDF
    console.log('\n📁 [2/6] Cargando archivo PDF...');
    const metadata = await localStorageService.getMetadata(documentId);
    
    if (!metadata) {
      throw new Error(`Metadatos no encontrados para ${documentId}`);
    }

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
    const pageIndexStartTime = Date.now();
    
    let pageIndex;
    try {
      pageIndex = await pageIndexService.buildIndex(
        documentId,
        pdfBuffer,
        document.name
      );
    } catch (error: any) {
      throw new Error(`Error en PageIndex: ${error.message}`);
    }

    const pageIndexDuration = ((Date.now() - pageIndexStartTime) / 1000).toFixed(2);
    console.log(`   ✓ PageIndex completado en ${pageIndexDuration}s`);

    // Paso 4: Guardar índices en PostgreSQL
    console.log('\n💾 [4/6] Guardando índices en PostgreSQL...');
    const nodes = pageIndexService.flattenNodes(pageIndex);
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
            },
            parentId: parentId,
          },
        });

        createdNodes.set(node.id, created.id);
      } catch (error: any) {
        console.error(`   ⚠️  Error guardando nodo ${node.id}:`, error.message);
      }
    }

    console.log(`   ✓ Índices guardados: ${createdNodes.size}/${nodes.length} nodos`);

    // Actualizar estado a INDEXED
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'INDEXED' },
    });
    console.log('   ✓ Estado actualizado: INDEXED');

    // Paso 5: Ejecutar Cognee (análisis de IA)
    console.log('\n🧠 [5/6] Ejecutando Cognee (extracción de conocimiento)...');
    const cogneeStartTime = Date.now();

    // Obtener índices directamente de la BD para análisis
    console.log('   - Obteniendo índices de PostgreSQL para análisis...');
    const indices = await prisma.pageIndex.findMany({
      where: { documentId },
      orderBy: { level: 'asc' },
    });

    console.log(`   - Obtenidos ${indices.length} nodos de índice`);

    // Combinar contenido de todos los nodos para análisis
    const content = indices
      .filter(n => n.content && n.content.length > 50)
      .map(n => `${n.title}: ${n.content?.slice(0, 2000)}`)
      .join('\n\n');

    console.log(`   - Contenido combinado: ${content.length} caracteres`);

    if (content.length < 100) {
      console.warn('   ⚠️  Contenido muy corto, el análisis puede ser limitado');
    }

    // Dividir en chunks para análisis
    const chunks = content.split(/\n\s*\n/).filter(c => c.trim().length > 100);
    console.log(`   - Analizando ${chunks.length} chunks de texto...`);
    console.log(`   - Dominio: ${domain || 'legal (default)'}`);

    let totalEntities = 0;
    let totalRelations = 0;

    // Configurar límite máximo de chunks a procesar (CONFIGURABLE)
    const MAX_CHUNKS_TO_PROCESS = parseInt(process.env.MAX_CHUNKS_TO_PROCESS || '500');
    const chunksToProcess = Math.min(chunks.length, MAX_CHUNKS_TO_PROCESS);

    console.log(`   - Procesando ${chunksToProcess}/${chunks.length} chunks (límite: ${MAX_CHUNKS_TO_PROCESS})`);

    // Procesar cada chunk con referencias a PageIndex
    for (let i = 0; i < chunksToProcess; i++) {
      const chunk = chunks[i];
      
      // Obtener referencia a PageIndex para este chunk
      const pageIndexNode = indices.find(idx => 
        idx.content && chunk.includes(idx.content?.slice(0, 500) || '')
      );

      const pageIndexReference = pageIndexNode ? {
        page: pageIndexNode.page || undefined,
        section: pageIndexNode.title,
        start_index: (pageIndexNode.metadata as any)?.start_index,
        end_index: (pageIndexNode.metadata as any)?.end_index,
      } : undefined;

      process.stdout.write(`   - Procesando chunk ${i + 1}/${chunksToProcess}...\r`);

      try {
        const { entities, relations } = await cogneeService.extractKnowledge(
          chunk,
          documentId,
          document.name,
          domain,
          pageIndexReference  // Pasar referencias a PageIndex
        );

        if (entities.length > 0) {
          const result = await cogneeService.persistToGraph(entities, relations, documentId);
          totalEntities += result.saved;
          totalRelations += relations.length - result.failed;
        }
      } catch (error: any) {
        console.warn(`     Error en chunk ${i + 1}:`, error.message);
      }

      // Pequeña pausa entre chunks
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const cogneeDuration = ((Date.now() - cogneeStartTime) / 1000).toFixed(2);
    console.log(`\n   ✓ Cognee completado en ${cogneeDuration}s`);
    console.log(`   ✓ Entidades extraídas: ${totalEntities}`);
    console.log(`   ✓ Relaciones extraídas: ${totalRelations}`);

    // Paso 6: Actualizar estado final
    console.log('\n✅ [6/6] Finalizando procesamiento...');
    
    // Verificar entidades en FalkorDB
    const { falkorDBService } = await import('./falkordb');
    const graphStats = await falkorDBService.query(
      `MATCH (n) WHERE n.documentId = "${documentId}" RETURN count(n) AS count`
    );
    const entitiesInGraph = graphStats.rows[0]?.count || 0;

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED',
        description: `${document.description || ''} | Entidades: ${entitiesInGraph}`.trim(),
      },
    });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESAMIENTO COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`⏱️  Tiempo total: ${totalDuration}s`);
    console.log(`📊 Estado final: ${entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED'}`);
    console.log(`🧠 Entidades en grafo: ${entitiesInGraph}`);
    console.log(`📑 Índices creados: ${createdNodes.size}`);
    console.log('='.repeat(60) + '\n');

    return {
      success: true,
      documentId,
      status: entitiesInGraph > 0 ? 'ANALYZED' : 'INDEXED',
      entities: entitiesInGraph,
      indices: createdNodes.size,
      duration: totalDuration,
    };

  } catch (error: any) {
    console.error('\n❌ ERROR en procesamiento:', error.message);
    console.error(error.stack);

    // Actualizar estado a FAILED
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', description: error.message.slice(0, 200) },
    });

    return {
      success: false,
      documentId,
      error: error.message,
    };
  }
}
