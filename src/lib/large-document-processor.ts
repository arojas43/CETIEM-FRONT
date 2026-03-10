/**
 * Procesamiento de PDF con streaming para documentos grandes (hasta 2GB)
 * Evita cargar todo el archivo en memoria
 */

import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import type { ProcessingProgress, TextChunk, ExtractionResult } from './large-document-types';
import { DOCUMENT_LIMITS } from './large-document-types';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

interface StreamedPDFResult {
  text: string;
  pages: string[];
  numpages: number;
  info: any;
  metadata: any;
  version: string;
}

/**
 * Extrae texto de PDF usando streaming para archivos grandes
 */
export async function extractTextFromPDFStreaming(
  filePath: string,
  fileSize: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const useStreaming = fileSize > DOCUMENT_LIMITS.STREAM_THRESHOLD;
  
  console.log(`[LargeDoc] Extrayendo texto de PDF: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`[LargeDoc] Usando streaming: ${useStreaming ? 'SÍ' : 'NO'}`);

  let result: StreamedPDFResult;

  if (useStreaming) {
    // Procesamiento por lotes de páginas para no saturar memoria
    result = await extractPDFForStreaming(filePath, fileSize, onProgress);
  } else {
    // Carga completa para archivos pequeños
    const buffer = await readFile(filePath);
    result = await pdfParse(buffer) as StreamedPDFResult;
    
    if (onProgress) {
      onProgress({
        status: 'EXTRACTING',
        percentage: 100,
        currentStep: 1,
        totalSteps: 1,
        details: {
          pagesProcessed: result.numpages,
          totalPages: result.numpages,
          bytesProcessed: fileSize,
          totalBytes: fileSize,
        },
        startedAt: startTime,
        updatedAt: Date.now(),
      });
    }
  }

  // Crear chunks para procesamiento posterior
  const chunks = createChunksFromText(result.text, DOCUMENT_LIMITS.CHUNK_SIZE, DOCUMENT_LIMITS.CHUNK_OVERLAP);

  const processingTime = Date.now() - startTime;

  console.log(`[LargeDoc] Extracción completada en ${(processingTime / 1000).toFixed(2)}s`);
  console.log(`[LargeDoc] Páginas: ${result.numpages}, Chunks: ${chunks.length}`);

  return {
    text: result.text,
    pages: result.pages,
    totalPages: result.numpages,
    requiresOcr: false,
    chunks,
    metadata: {
      fileSize,
      processingTime,
      streamingUsed: useStreaming,
    },
  };
}

/**
 * Extrae PDF página por página para evitar saturar memoria
 */
async function extractPDFForStreaming(
  filePath: string,
  fileSize: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<StreamedPDFResult> {
  // Primero obtenemos información básica del PDF
  const buffer = await readFile(filePath, { encoding: 'binary' });
  const initialResult = await pdfParse(Buffer.from(buffer, 'binary')) as StreamedPDFResult;
  
  const totalPages = initialResult.numpages;
  const allText: string[] = [];
  const allPages: string[] = [];
  
  // Procesar en lotes de páginas
  const batchSize = Math.max(1, Math.floor(totalPages / 10)); // 10 lotes
  let processedPages = 0;

  console.log(`[LargeDoc] Procesando ${totalPages} páginas en lotes de ${batchSize}`);

  for (let startPage = 1; startPage <= totalPages; startPage += batchSize) {
    const endPage = Math.min(startPage + batchSize - 1, totalPages);
    const batchStartTime = Date.now();
    
    console.log(`[LargeDoc] Procesando páginas ${startPage}-${endPage} de ${totalPages}`);
    
    // Extraer páginas del lote
    const batchBuffer = Buffer.from(buffer, 'binary');
    const batchResult = await pdfParse(batchBuffer, {
      pagebreak: (pageNum: number) => pageNum >= startPage && pageNum <= endPage,
    }) as StreamedPDFResult;

    if (batchResult.text) {
      allText.push(batchResult.text);
    }
    
    processedPages += (endPage - startPage + 1);
    
    // Reportar progreso
    if (onProgress) {
      onProgress({
        status: 'STREAMING',
        percentage: Math.round((processedPages / totalPages) * 100),
        currentStep: processedPages,
        totalSteps: totalPages,
        details: {
          pagesProcessed: processedPages,
          totalPages,
          bytesProcessed: Math.round((processedPages / totalPages) * fileSize),
          totalBytes: fileSize,
        },
        startedAt: batchStartTime,
        updatedAt: Date.now(),
      });
    }

    // Pequeña pausa para no saturar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return {
    text: allText.join('\n\n'),
    pages: allPages,
    numpages: totalPages,
    info: initialResult.info,
    metadata: initialResult.metadata,
    version: initialResult.version,
  };
}

/**
 * Divide texto en chunks manejables para LLM
 */
export function createChunksFromText(
  text: string,
  chunkSize: number = DOCUMENT_LIMITS.CHUNK_SIZE,
  overlap: number = DOCUMENT_LIMITS.CHUNK_OVERLAP
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  // Dividir por párrafos primero para mantener coherencia
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  let currentStart = 0;

  for (const paragraph of paragraphs) {
    const paragraphWithBreak = paragraph + '\n\n';
    
    // Si el párrafo solo es más grande que chunkSize, dividirlo
    if (paragraphWithBreak.length > chunkSize) {
      // Guardar chunk actual si tiene contenido
      if (currentChunk.length > 0) {
        chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
        currentStart += currentChunk.length;
        currentChunk = '';
      }
      
      // Dividir párrafo grande en sub-chunks
      const subChunks = splitLargeText(paragraphWithBreak, chunkSize);
      for (const subChunk of subChunks) {
        chunks.push(createChunk(chunkIndex++, subChunk, currentStart));
        currentStart += subChunk.length;
      }
    } else if (currentChunk.length + paragraphWithBreak.length > chunkSize) {
      // Chunk lleno, guardar y comenzar nuevo
      chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
      currentStart += currentChunk.length;
      currentChunk = paragraphWithBreak;
    } else {
      // Agregar al chunk actual
      currentChunk += paragraphWithBreak;
    }
  }

  // Guardar último chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
  }

  console.log(`[LargeDoc] Creados ${chunks.length} chunks de texto`);
  
  return chunks;
}

/**
 * Crea un objeto TextChunk
 */
function createChunk(index: number, content: string, startOffset: number): TextChunk {
  return {
    id: `chunk-${index}-${Date.now()}`,
    index,
    content: content.trim(),
    startOffset,
    endOffset: startOffset + content.length,
    metadata: {
      charCount: content.length,
    },
  };
}

/**
 * Divide texto grande en partes más pequeñas
 */
function splitLargeText(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxSize) {
    // Encontrar punto de corte en espacio o párrafo
    let cutPoint = maxSize;
    
    // Intentar cortar en fin de oración
    const lastPeriod = remaining.lastIndexOf('.', maxSize);
    const lastNewline = remaining.lastIndexOf('\n', maxSize);
    const lastSpace = remaining.lastIndexOf(' ', maxSize);
    
    cutPoint = Math.max(lastPeriod, lastNewline, lastSpace);
    
    if (cutPoint <= 0) {
      cutPoint = maxSize; // Forzar corte si no hay punto conveniente
    }

    chunks.push(remaining.substring(0, cutPoint).trim());
    remaining = remaining.substring(cutPoint).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining.trim());
  }

  return chunks;
}

/**
 * Obtiene progreso estimado de procesamiento
 */
export function estimateProgress(
  processedBytes: number,
  totalBytes: number,
  startTime: number
): ProcessingProgress {
  const elapsed = Date.now() - startTime;
  const percentage = Math.round((processedBytes / totalBytes) * 100);
  const bytesPerSecond = processedBytes / (elapsed / 1000);
  const remainingBytes = totalBytes - processedBytes;
  const estimatedRemaining = bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : 0;

  return {
    status: 'STREAMING',
    percentage,
    currentStep: Math.round(processedBytes),
    totalSteps: totalBytes,
    details: {
      bytesProcessed: processedBytes,
      totalBytes,
    },
    estimatedTimeRemaining: Math.round(estimatedRemaining / 1000),
    startedAt: startTime,
    updatedAt: Date.now(),
  };
}
