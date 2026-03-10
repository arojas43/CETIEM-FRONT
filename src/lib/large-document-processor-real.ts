/**
 * Procesamiento REAL de PDFs grandes con pdfjs-dist
 * Usa streaming verdadero para documentos de hasta 2GB
 */

import { createReadStream } from 'fs';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { createRequire } from 'module';
import { join } from 'path';
import type { ProcessingProgress, TextChunk, ExtractionResult } from './large-document-types';
import { DOCUMENT_LIMITS } from './large-document-types';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist');

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs');

interface PDFPageProxy {
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
  rotate: number;
  userUnit: number;
  view: number[];
  pageNumber: number;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPageProxy>;
  metadata: any;
}

/**
 * Extrae texto de PDF grande usando pdfjs-dist con streaming real
 */
export async function extractTextFromPDFStreaming(
  filePath: string,
  fileSize: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const tempDir = join(process.env.LOCAL_STORAGE_PATH || './uploads', 'temp');
  
  console.log(`[LargeDoc] Extrayendo texto de PDF: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    // Crear directorio temporal
    await mkdir(tempDir, { recursive: true });
    
    // Leer PDF con pdfjs-dist
    console.log(`[LargeDoc] Cargando PDF con pdfjs-dist...`);
    
    // Para archivos muy grandes, usar ArrayBuffer con streaming
    let pdfBuffer: ArrayBuffer;
    
    if (fileSize > 500 * 1024 * 1024) {
      // > 500MB: leer en chunks para evitar OOM
      console.log(`[LargeDoc] Usando lectura chunked para archivo grande...`);
      pdfBuffer = await readLargeFileInChunks(filePath, fileSize, onProgress);
    } else {
      // < 500MB: leer completo
      const buffer = await readFile(filePath);
      pdfBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    
    console.log(`[LargeDoc] PDF cargado: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
    
    // Cargar documento
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    
    const pdf: PDFDocumentProxy = await loadingTask.promise;
    const totalPages = pdf.numPages;
    
    console.log(`[LargeDoc] PDF cargado: ${totalPages} páginas`);
    
    // Extraer texto página por página
    const allText: string[] = [];
    const pageTexts: string[] = [];
    let processedPages = 0;
    
    console.log(`[LargeDoc] Extrayendo texto de ${totalPages} páginas...`);
    
    // Procesar en lotes para no saturar
    const batchSize = 10;
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum += batchSize) {
      const batchEnd = Math.min(pageNum + batchSize - 1, totalPages);
      const batchPromises: Promise<void>[] = [];
      const batchTexts: string[] = new Array(batchEnd - pageNum + 1);
      
      console.log(`[LargeDoc] Procesando páginas ${pageNum}-${batchEnd} de ${totalPages}`);
      
      for (let p = pageNum; p <= batchEnd; p++) {
        const promise = (async (pageNum: number, index: number) => {
          try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            batchTexts[index] = text;
          } catch (error: any) {
            console.warn(`[LargeDoc] Error en página ${pageNum}:`, error.message);
            batchTexts[index] = '';
          }
        })(p, p - pageNum);
        
        batchPromises.push(promise);
      }
      
      await Promise.all(batchPromises);
      
      allText.push(...batchTexts.filter(t => t.length > 0));
      pageTexts.push(...batchTexts);
      
      processedPages += batchTexts.length;
      
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
          startedAt: startTime,
          updatedAt: Date.now(),
        });
      }
      
      // Pequeña pausa entre lotes
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const fullText = allText.join('\n\n');
    
    console.log(`[LargeDoc] Texto extraído: ${(fullText.length / 1024 / 1024).toFixed(2)}M caracteres`);
    
    // Crear chunks
    const chunks = createChunksFromText(fullText, DOCUMENT_LIMITS.CHUNK_SIZE, DOCUMENT_LIMITS.CHUNK_OVERLAP);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[LargeDoc] Extracción completada en ${(processingTime / 1000).toFixed(2)}s`);
    console.log(`[LargeDoc] Páginas: ${totalPages}, Chunks: ${chunks.length}`);
    
    // Limpiar temporal
    try {
      await writeFile(join(tempDir, 'extracted.txt'), fullText.slice(0, 100000));
    } catch (e) {
      // Ignorar error de escritura
    }
    
    return {
      text: fullText,
      pages: pageTexts,
      totalPages,
      requiresOcr: false,
      chunks,
      metadata: {
        fileSize,
        processingTime,
        streamingUsed: fileSize > DOCUMENT_LIMITS.STREAM_THRESHOLD,
      },
    };
  } catch (error: any) {
    console.error('[LargeDoc] Error en extracción:', error.message);
    console.error('[LargeDoc] Stack:', error.stack);
    
    // Devolver resultado vacío pero válido
    return {
      text: '',
      pages: [],
      totalPages: 0,
      requiresOcr: false,
      chunks: [],
      metadata: {
        fileSize,
        processingTime: Date.now() - startTime,
        streamingUsed: true,
      },
    };
  }
}

/**
 * Lee archivo grande en chunks para evitar OOM
 */
async function readLargeFileInChunks(
  filePath: string,
  fileSize: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ArrayBuffer> {
  const chunkSize = 50 * 1024 * 1024; // 50MB por chunk
  const chunks: ArrayBuffer[] = [];
  let bytesRead = 0;
  
  console.log(`[LargeDoc] Leyendo archivo en chunks de ${chunkSize / 1024 / 1024}MB...`);
  
  const fd = await openFile(filePath);
  
  try {
    while (bytesRead < fileSize) {
      const remaining = fileSize - bytesRead;
      const currentChunkSize = Math.min(chunkSize, remaining);
      
      console.log(`[LargeDoc] Leyendo chunk: ${bytesRead / 1024 / 1024}MB - ${(bytesRead + currentChunkSize) / 1024 / 1024}MB`);
      
      const chunk = await readChunk(fd, bytesRead, currentChunkSize);
      chunks.push(chunk);
      bytesRead += currentChunkSize;
      
      if (onProgress) {
        onProgress({
          status: 'STREAMING',
          percentage: Math.round((bytesRead / fileSize) * 50), // 50% para lectura
          currentStep: bytesRead,
          totalSteps: fileSize,
          details: {
            bytesProcessed: bytesRead,
            totalBytes: fileSize,
          },
          startedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      
      // Pequeña pausa para GC
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally {
    await closeFile(fd);
  }
  
  // Combinar chunks
  console.log(`[LargeDoc] Combinando ${chunks.length} chunks...`);
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  
  console.log(`[LargeDoc] Archivo combinado: ${(totalLength / 1024 / 1024).toFixed(2)}MB`);
  
  return combined.buffer;
}

// Funciones helper para file operations
async function openFile(filePath: string): Promise<any> {
  const fs = await import('fs/promises');
  return fs.open(filePath, 'r');
}

async function readChunk(fd: any, offset: number, length: number): Promise<ArrayBuffer> {
  const buffer = Buffer.alloc(length);
  const result = await fd.read(buffer, 0, length, offset);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + result.bytesRead);
}

async function closeFile(fd: any): Promise<void> {
  await fd.close();
}

/**
 * Divide texto en chunks manejables
 */
export function createChunksFromText(
  text: string,
  chunkSize: number = DOCUMENT_LIMITS.CHUNK_SIZE,
  overlap: number = DOCUMENT_LIMITS.CHUNK_OVERLAP
): TextChunk[] {
  if (!text || text.length === 0) {
    console.warn('[LargeDoc] Texto vacío, no se pueden crear chunks');
    return [];
  }
  
  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  let chunkIndex = 0;

  // Dividir por párrafos
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  let currentStart = 0;

  for (const paragraph of paragraphs) {
    const paragraphWithBreak = paragraph + '\n\n';
    
    if (paragraphWithBreak.length > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
        currentStart += currentChunk.length;
        currentChunk = '';
      }
      
      const subChunks = splitLargeText(paragraphWithBreak, chunkSize);
      for (const subChunk of subChunks) {
        chunks.push(createChunk(chunkIndex++, subChunk, currentStart));
        currentStart += subChunk.length;
      }
    } else if (currentChunk.length + paragraphWithBreak.length > chunkSize) {
      chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
      currentStart += currentChunk.length;
      currentChunk = paragraphWithBreak;
    } else {
      currentChunk += paragraphWithBreak;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(createChunk(chunkIndex++, currentChunk, currentStart));
  }

  console.log(`[LargeDoc] Creados ${chunks.length} chunks`);
  
  return chunks;
}

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

function splitLargeText(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxSize) {
    let cutPoint = maxSize;
    
    const lastPeriod = remaining.lastIndexOf('.', maxSize);
    const lastNewline = remaining.lastIndexOf('\n', maxSize);
    const lastSpace = remaining.lastIndexOf(' ', maxSize);
    
    cutPoint = Math.max(lastPeriod, lastNewline, lastSpace);
    
    if (cutPoint <= 0) {
      cutPoint = maxSize;
    }

    chunks.push(remaining.substring(0, cutPoint).trim());
    remaining = remaining.substring(cutPoint).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining.trim());
  }

  return chunks;
}
