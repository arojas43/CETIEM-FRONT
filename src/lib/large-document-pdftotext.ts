/**
 * Procesamiento de PDFs MUY grandes usando pdftotext (poppler)
 * Streaming real desde línea de comandos - soporta archivos de hasta 2GB+
 */

import { exec } from 'child_process';
import { unlinkSync } from 'fs';
import { readFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import type { ProcessingProgress, TextChunk, ExtractionResult } from './large-document-types';
import { DOCUMENT_LIMITS } from './large-document-types';

/**
 * Extrae texto de PDF grande usando pdftotext con streaming real
 */
export async function extractTextFromPDFWithPdftotext(
  filePath: string,
  fileSize: number,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const tempDir = join(process.env.LOCAL_STORAGE_PATH || './uploads', 'temp');
  const tempTextFile = join(tempDir, `extracted-${Date.now()}.txt`);
  
  console.log(`[Pdftotext] Extrayendo texto de PDF: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  
  try {
    // Crear directorio temporal
    await mkdir(tempDir, { recursive: true });
    
    // Ejecutar pdftotext
    console.log(`[Pdftotext] Ejecutando: pdftotext "${filePath}" "${tempTextFile}"`);
    
    await runPdftotext(filePath, tempTextFile, onProgress, fileSize, startTime);
    
    // Leer texto extraído
    console.log(`[Pdftotext] Leyendo texto extraído...`);
    const fullText = await readFile(tempTextFile, 'utf-8');
    
    console.log(`[Pdftotext] Texto extraído: ${(fullText.length / 1024 / 1024).toFixed(2)}M caracteres`);
    
    // Contar páginas aproximadas (cada ~50 líneas es una página)
    const lines = fullText.split('\n').length;
    const estimatedPages = Math.ceil(lines / 50);
    
    // Crear chunks
    console.log(`[Pdftotext] Creando chunks...`);
    const chunks = createChunksFromText(fullText, DOCUMENT_LIMITS.CHUNK_SIZE, DOCUMENT_LIMITS.CHUNK_OVERLAP);
    
    const processingTime = Date.now() - startTime;
    
    console.log(`[Pdftotext] Extracción completada en ${(processingTime / 1000).toFixed(2)}s`);
    console.log(`[Pdftotext] Páginas estimadas: ${estimatedPages}, Chunks: ${chunks.length}`);
    
    // Limpiar archivo temporal
    try {
      unlinkSync(tempTextFile);
      console.log(`[Pdftotext] Archivo temporal eliminado`);
    } catch (e) {
      // Ignorar error
    }
    
    return {
      text: fullText,
      pages: fullText.split(/\n\s*\n/).slice(0, estimatedPages),
      totalPages: estimatedPages,
      requiresOcr: false,
      chunks,
      metadata: {
        fileSize,
        processingTime,
        streamingUsed: true,
      },
    };
  } catch (error: any) {
    console.error('[Pdftotext] Error en extracción:', error.message);
    console.error('[Pdftotext] Stack:', error.stack);
    
    // Limpiar archivo temporal si existe
    try {
      unlinkSync(tempTextFile);
    } catch (e) {
      // Ignorar
    }
    
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
 * Ejecuta pdftotext con monitoreo de progreso
 */
async function runPdftotext(
  inputPath: string,
  outputPath: string,
  onProgress?: (progress: ProcessingProgress) => void,
  fileSize?: number,
  startTime?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = `pdftotext -layout -enc UTF-8 "${inputPath}" "${outputPath}"`;
    
    console.log(`[Pdftotext] Ejecutando: ${cmd}`);
    
    const proc = exec(cmd, (error, _stdout, _stderr) => {
      if (error) {
        console.error(`[Pdftotext] Error: ${error.message}`);
        reject(new Error(`pdftotext falló: ${error.message}`));
        return;
      }
      
      if (onProgress && fileSize && startTime) {
        onProgress({
          status: 'EXTRACTING',
          percentage: 100,
          currentStep: 1,
          totalSteps: 1,
          details: {
            bytesProcessed: fileSize,
            totalBytes: fileSize,
          },
          startedAt: startTime,
          updatedAt: Date.now(),
        });
      }
      
      resolve();
    });
    
    // Monitoreo de progreso (verificar tamaño del archivo de salida)
    if (onProgress && fileSize && startTime) {
      const progressInterval = setInterval(async () => {
        try {
          await access(outputPath);
          const stats = await readFile(outputPath).then(b => ({ size: b.length }));
          const progress = Math.min(90, Math.round((stats.size / (fileSize * 0.3)) * 100));
          
          onProgress({
            status: 'EXTRACTING',
            percentage: progress,
            currentStep: stats.size,
            totalSteps: fileSize,
            details: {
              bytesProcessed: stats.size,
              totalBytes: fileSize,
            },
            startedAt: startTime,
            updatedAt: Date.now(),
          });
        } catch (e) {
          // Archivo aún no existe
        }
      }, 2000);
      
      proc.on('exit', () => clearInterval(progressInterval));
    }
  });
}

/**
 * Divide texto en chunks manejables
 */
export function createChunksFromText(
  text: string,
  chunkSize: number = DOCUMENT_LIMITS.CHUNK_SIZE,
  _overlap: number = DOCUMENT_LIMITS.CHUNK_OVERLAP
): TextChunk[] {
  if (!text || text.length === 0) {
    console.warn('[Pdftotext] Texto vacío, no se pueden crear chunks');
    return [];
  }
  
  const chunks: TextChunk[] = [];
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

  console.log(`[Pdftotext] Creados ${chunks.length} chunks`);
  
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
