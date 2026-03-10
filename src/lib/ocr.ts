// Servicio de OCR con Tesseract.js
import Tesseract from 'tesseract.js';
import { createRequire } from "module";

/**
 * Extrae texto de una imagen usando Tesseract OCR
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  lang: string = 'spa'
): Promise<string> {
  try {
    const { data: { text } } = await Tesseract.recognize(imageBuffer, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`  [OCR] Progreso: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    return text.trim();
  } catch (error: any) {
    console.error('[OCR] Error:', error.message);
    return '';
  }
}

/**
 * Procesa un PDF con OCR página por página
 * Usa pdfjs-dist para convertir páginas a imágenes y luego aplica OCR
 */
export async function processPdfWithOcr(pdfBuffer: Buffer, lang: string = 'spa'): Promise<{
  text: string;
  pages: string[];
  ocrConfidence: number;
}> {
  console.log('[OCR] Iniciando procesamiento con OCR...');
  
  try {
    // Import dinámico de pdfjs-dist
    const require = createRequire(import.meta.url);
    const pdfjsLib = require('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
    
    const pdfData = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;
    
    const numPages = pdfDocument.numPages;
    console.log(`[OCR] PDF tiene ${numPages} páginas`);
    
    const pages: string[] = [];
    let fullText = '';
    let totalConfidence = 0;
    
    for (let i = 1; i <= numPages; i++) {
      console.log(`[OCR] Procesando página ${i}/${numPages}...`);
      
      try {
        // Obtener página
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        
        // Crear canvas virtual
        const canvas = require('canvas');
        const canvasInstance = canvas.createCanvas(viewport.width, viewport.height);
        const ctx = canvasInstance.getContext('2d');
        
        // Renderizar página en canvas
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;
        
        // Convertir a buffer de imagen
        const imageBuffer = canvasInstance.toBuffer('image/png');
        
        // Aplicar OCR
        const { data: { text, confidence } } = await Tesseract.recognize(imageBuffer, lang, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`  [OCR] Página ${i}: ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        
        const pageText = text.trim();
        pages.push(pageText);
        fullText += `--- Página ${i} ---\n\n${pageText}\n\n`;
        totalConfidence += confidence;
        
        console.log(`[OCR] Página ${i} completada (${confidence.toFixed(1)}% confianza)`);
        
      } catch (pageError: any) {
        console.error(`[OCR] Error en página ${i}:`, pageError.message);
        pages.push(`[Error al procesar página ${i}]`);
        fullText += `[Error al procesar página ${i}]\n\n`;
      }
    }
    
    const avgConfidence = totalConfidence / numPages;
    console.log(`[OCR] Completado. Confianza promedio: ${avgConfidence.toFixed(1)}%`);
    
    return {
      text: fullText,
      pages,
      ocrConfidence: avgConfidence,
    };
    
  } catch (error: any) {
    console.error('[OCR] Error grave:', error.message);
    // Fallback: intentar sin canvas
    return processPdfWithOcrFallback(pdfBuffer, lang);
  }
}

/**
 * Fallback cuando no hay canvas disponible
 * Usa el texto básico extraído por pdf-parse
 */
async function processPdfWithOcrFallback(pdfBuffer: Buffer, lang: string): Promise<{
  text: string;
  pages: string[];
  ocrConfidence: number;
}> {
  console.log('[OCR] Usando fallback (sin canvas)');
  
  const pdfParseModule = require('pdf-parse');
  const pdfParse = pdfParseModule.default || pdfParseModule;
  
  const data = await pdfParse(pdfBuffer);
  
  const cleanText = (text: string) => text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  
  const text = cleanText(data.text) || `[OCR no disponible - PDF de ${data.numpages} páginas]`;
  
  return {
    text,
    pages: [text],
    ocrConfidence: 0,
  };
}
