// Extracción de texto de PDF con OCR opcional
// Usando importación dinámica asíncrona

import { createRequire } from "module";

// Cache del módulo pdf-parse
let _pdfParse: any = null;

/**
 * Obtiene pdf-parse dinámicamente (lazy loading)
 */
async function getPdfParse(): Promise<any> {
  if (!_pdfParse) {
    const require = createRequire(import.meta.url);
    const pdfParseModule = require('pdf-parse');
    _pdfParse = pdfParseModule.default || pdfParseModule;
  }
  return _pdfParse;
}

/**
 * Limpia texto de caracteres inválidos para PostgreSQL
 */
export function cleanText(text: string): string {
  return text
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\u{FFFD}]/gu, '')
    .trim();
}

export interface PDFExtractResult {
  text: string;
  numpages: number;
  info: any;
  metadata: any | null;
  version: string;
  hasText: boolean;
  requiresOcr?: boolean;
  error?: string;
}

/**
 * Extrae texto de un PDF
 * Si el PDF no tiene texto (escaneado), devuelve metadata básica
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFExtractResult> {
  try {
    const pdfParse = await getPdfParse();
    const data = await pdfParse(pdfBuffer);

    // Verificar si se extrajo texto significativo
    const hasText = data.text && data.text.trim().length > 50;

    if (hasText) {
      // PDF con texto extraíble
      return {
        text: cleanText(data.text),
        numpages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version,
        hasText: true,
      };
    } else {
      // PDF escaneado o sin texto
      console.log('[PDF] PDF sin texto detectado, se requiere OCR');
      return {
        text: `Documento PDF de ${data.numpages} páginas\n\n` +
              `Nota: Este documento parece ser una imagen escaneada.\n` +
              `Se requiere OCR para extraer el texto completo.\n` +
              `Información: ${JSON.stringify(data.info || {}, null, 2)}`,
        numpages: data.numpages,
        info: data.info,
        metadata: data.metadata,
        version: data.version,
        hasText: false,
        requiresOcr: true,
      };
    }
  } catch (error: any) {
    console.error('[PDF] Error:', error.message);
    return {
      text: 'Documento PDF (texto no extraído)',
      numpages: 1,
      info: {},
      metadata: null,
      version: '',
      hasText: false,
      error: error.message,
    };
  }
}
