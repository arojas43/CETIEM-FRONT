/**
 * Implementación REAL de PageIndex basada en https://github.com/VectifyAI/PageIndex
 * 
 * PageIndex crea un árbol jerárquico del documento:
 * - Root: Título del documento
 * - Level 1: Capítulos principales
 * - Level 2: Subsecciones
 * - etc.
 * 
 * Cada nodo contiene:
 * - title: Título de la sección
 * - content: Texto completo de esa sección
 * - page: Página donde comienza
 * - summary: Resumen generado por LLM (opcional)
 */

import { nimService } from "./nim";

// pdfjs-dist/legacy requiere DOMMatrix en Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    multiply(_o: any) { return this; }
    invertSelf() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p; }
    toFloat32Array() { return new Float32Array(16); }
    toFloat64Array() { return new Float64Array(16); }
    toString() { return 'matrix(1,0,0,1,0,0)'; }
  };
}

/**
 * Extrae el primer objeto JSON válido de un string de texto libre.
 * Usa conteo de llaves balanceadas — más robusto que un regex greedy.
 */
function extractFirstJSON(text: string): any | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

export interface PageIndexNode {
  id: string;
  level: number;
  title: string;
  content?: string;
  page?: number;
  endPage?: number;
  summary?: string;
  metadata?: Record<string, any>;
  children: PageIndexNode[];
  parentId?: string;
}

export interface PageIndexDocument {
  id: string;
  name: string;
  root: PageIndexNode;
  createdAt: Date;
  totalPages: number;
}

export class PageIndexService {
  private pdfjsLib: any;

  constructor() {
    this.pdfjsLib = null;
  }

  /**
   * Carga pdfjs-dist/legacy dinámicamente (solo en runtime, no en build).
   * El build legacy es el recomendado para entornos Node.js server-side (v4.x).
   * pdfjs-dist está en serverExternalPackages → no bundleado por webpack.
   */
  private async loadPdfjs(): Promise<any> {
    if (!this.pdfjsLib) {
      // pdfjs-dist v4 legacy build — compatible con Node.js 20+
      const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
      this.pdfjsLib = (pdfjsMod as any).default ?? pdfjsMod;

      // Worker para Node.js — apuntar al archivo del worker
      if (this.pdfjsLib.GlobalWorkerOptions) {
        const { resolve } = await import('path');
        const workerPath = resolve(
          process.cwd(),
          'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
        );
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
      }
    }
    return this.pdfjsLib;
  }

  /**
   * Extrae texto de una página específica de PDF
   */
  async extractPageText(pdfDocument: any, pageNum: number): Promise<string> {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      if (!items.length) return '';

      // Reconstruir texto preservando estructura de párrafos/líneas mediante
      // análisis de posición Y y la propiedad hasEOL de cada item de pdfjs.
      let text = '';
      let prevY: number | null = null;

      for (const item of items) {
        if (!item.str) continue;

        const curY: number = item.transform?.[5] ?? 0;

        if (prevY === null) {
          text += item.str;
        } else {
          const yGap = Math.abs(curY - prevY);

          if (item.hasEOL || yGap > 20) {
            // Salto grande → separador de párrafo
            text += '\n\n' + item.str;
          } else if (yGap > 8) {
            // Salto pequeño → nueva línea dentro del mismo párrafo
            text += '\n' + item.str;
          } else {
            text += ' ' + item.str;
          }
        }

        prevY = curY;
      }

      return text
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/[ \t]+/g, ' ')      // Colapsar espacios horizontales sin tocar \n
        .replace(/\n{3,}/g, '\n\n')   // Máximo un párrafo en blanco
        .trim();
    } catch (error: any) {
      console.error(`[PageIndex] Error extrayendo página ${pageNum}:`, error.message);
      return '';
    }
  }

  /**
   * Extrae TODO el texto de un PDF página por página
   */
  async extractFullText(pdfBuffer: Buffer): Promise<{ text: string; pages: string[] }> {
    const pdfjsLib = await this.loadPdfjs();
    const pdfData = new Uint8Array(pdfBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;
    
    const pages: string[] = [];
    let fullText = '';
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      console.log(`[PageIndex] Extrayendo página ${i}/${pdfDocument.numPages}...`);
      const pageText = await this.extractPageText(pdfDocument, i);
      pages.push(pageText);
      fullText += `\n\n--- PÁGINA ${i} ---\n\n${pageText}`;
    }
    
    return {
      text: fullText,
      pages,
    };
  }

  /**
   * Detecta títulos y secciones en el texto usando LLM
   * Similar a como PageIndex analiza la estructura del documento
   */
  async detectStructure(text: string): Promise<{
    title: string;
    description?: string;
    sections: Array<{
      title: string;
      level: number;
      startPage?: number;
      endPage?: number;
      summary?: string;
    }>;
  }> {
    // Dividir texto en chunks de 10000 caracteres para el LLM
    const chunks = [];
    const chunkSize = 10000;
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    const prompt = `Analiza este documento y extrae SU ESTRUCTURA JERÁRQUICA COMPLETA.

IMPORTANTE: Identifica TODOS los títulos, capítulos, secciones y subsecciones.
Para cada uno, indica su nivel jerárquico (1=capítulo principal, 2=subcapítulo, etc.)

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "title": "Título PRINCIPAL del documento",
  "description": "Descripción breve del documento (1 oración)",
  "sections": [
    {
      "title": "Nombre del Capítulo 1",
      "level": 1,
      "startPage": 1,
      "endPage": 5,
      "summary": "Resumen de 1 oración de qué trata esta sección"
    },
    {
      "title": "Subsección 1.1",
      "level": 2,
      "startPage": 2,
      "endPage": 3,
      "summary": "Resumen breve"
    }
  ]
}

Texto del documento (primeros ${Math.min(30000, text.length)} caracteres):
${text.slice(0, 30000)}`;

    try {
      console.log('[PageIndex] Detectando estructura con LLM...');
      const response = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
        prompt,
        systemPrompt: "Eres un experto analista documental. Tu trabajo es extraer la estructura jerárquica EXACTA de documentos.",
        maxTokens: 3000,
        temperature: 0.3, // Bajo para mayor precisión
      });

      // Extraer JSON con extractor robusto de llaves balanceadas
      const parsed = extractFirstJSON(response);
      if (parsed) {
        console.log(`[PageIndex] Estructura detectada: ${parsed.sections?.length || 0} secciones`);
        return parsed;
      }

      throw new Error('No se pudo parsear JSON');
    } catch (error: any) {
      console.error('[PageIndex] Error detectando estructura:', error.message);
      
      // Fallback: estructura simple por páginas
      return {
        title: "Documento",
        description: "Documento procesado automáticamente",
        sections: [],
      };
    }
  }

  /**
   * Construye el árbol PageIndex completo
   * Este es el método PRINCIPAL que imita a PageIndex original
   */
  async buildIndex(
    documentId: string,
    pdfBuffer: Buffer,
    name: string
  ): Promise<PageIndexDocument> {
    console.log('[PageIndex] Iniciando extracción de texto...');
    
    // Paso 1: Extraer TODO el texto
    const { text, pages } = await this.extractFullText(pdfBuffer);
    console.log(`[PageIndex] Texto extraído: ${text.length} caracteres, ${pages.length} páginas`);

    // Paso 2: Detectar estructura jerárquica
    const structure = await this.detectStructure(text);

    // Paso 3: Construir árbol
    console.log('[PageIndex] Construyendo árbol jerárquico...');
    
    const root: PageIndexNode = {
      id: crypto.randomUUID(),
      level: 0,
      title: structure.title,
      content: text.slice(0, 5000), // Primeros 5000 chars como resumen del doc
      page: 1,
      endPage: pages.length,
      summary: structure.description,
      children: [],
      metadata: {
        ocrApplied: false,
        totalPages: pages.length,
      },
    };

    // Paso 4: Crear nodos de sección (si se detectaron) + siempre nodos por página
    const nodes: PageIndexNode[] = [];

    if (structure.sections.length > 0) {
      // Secciones detectadas → nivel 1
      for (const section of structure.sections) {
        const node = this.createNodeFromSection(section, text, pages, root.id);
        nodes.push(node);
        root.children.push(node);
      }
      console.log(`[PageIndex] Árbol creado con ${nodes.length} secciones detectadas`);
    }

    // SIEMPRE añadir nodos individuales por página (nivel 2).
    // Esto garantiza que consultas como "página 15, párrafo 4" encuentren
    // exactamente el contenido de esa página aunque no haya sección detectada.
    pages.forEach((pageText, index) => {
      const pageNum = index + 1;
      const pageNode: PageIndexNode = {
        id: crypto.randomUUID(),
        level: structure.sections.length > 0 ? 2 : 1,
        title: `Página ${pageNum}`,
        page: pageNum,
        endPage: pageNum,
        // Hasta 10 000 chars para tener texto completo disponible en Q&A
        content: pageText.slice(0, 10000),
        children: [],
        parentId: root.id,
        metadata: {
          isPageNode: true,
          pageNumber: pageNum,
        },
      };
      nodes.push(pageNode);
      root.children.push(pageNode);
    });

    if (structure.sections.length === 0) {
      console.log('[PageIndex] Sin secciones detectadas → usando nodos por página');
    }

    console.log(`[PageIndex] Total nodos: ${nodes.length} (${structure.sections.length} secciones + ${pages.length} páginas)`);

    return {
      id: documentId,
      name,
      root,
      createdAt: new Date(),
      totalPages: pages.length,
    };
  }

  /**
   * Crea un nodo PageIndex desde una sección detectada
   */
  private createNodeFromSection(
    section: {
      title: string;
      level: number;
      startPage?: number;
      endPage?: number;
      summary?: string;
    },
    _fullText: string,
    pages: string[],
    parentId: string
  ): PageIndexNode {
    // Extraer contenido de las páginas de esta sección
    const startPage = section.startPage || 1;
    const endPage = section.endPage || startPage;
    
    let sectionContent = '';
    for (let i = startPage - 1; i < Math.min(endPage, pages.length); i++) {
      sectionContent += pages[i] + '\n';
    }

    return {
      id: crypto.randomUUID(),
      level: section.level,
      title: section.title,
      page: startPage,
      endPage,
      content: sectionContent.slice(0, 10000), // 10 000 chars para Q&A preciso
      summary: section.summary,
      children: [],
      parentId,
      metadata: {
        extractedAt: new Date().toISOString(),
        endPage,   // Guardado explícitamente para búsquedas de rango en Q&A
      },
    };
  }

  /**
   * Aplanar todos los nodos del árbol para guardar en BD
   */
  flattenNodes(index: PageIndexDocument): PageIndexNode[] {
    const nodes: PageIndexNode[] = [];
    
    const traverse = (node: PageIndexNode) => {
      nodes.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    };
    
    traverse(index.root);
    return nodes;
  }

  /**
   * Consulta el índice PageIndex
   * Similar al "tree search" de PageIndex original
   */
  async query(index: PageIndexDocument, query: string): Promise<{
    query: string;
    results: Array<{
      nodeId: string;
      title: string;
      content?: string;
      page?: number;
      relevance: number;
      path: string[];
    }>;
    context: string;
  }> {
    const results = await this.searchInTree(index.root, query);
    results.sort((a, b) => b.relevance - a.relevance);

    return {
      query,
      results: results.slice(0, 10), // Top 10 resultados
      context: results.slice(0, 5).map(r => `[${r.title}, pág ${r.page}]: ${r.content?.slice(0, 300)}`).join('\n\n'),
    };
  }

  private async searchInTree(node: PageIndexNode, query: string): Promise<any[]> {
    const results: any[] = [];
    
    if (node.content) {
      const relevance = this.calculateRelevance(node.content, query);
      if (relevance > 0.1) { // Umbral mínimo
        results.push({
          nodeId: node.id,
          title: node.title,
          content: node.content,
          page: node.page,
          relevance,
          path: [node.title],
        });
      }
    }

    for (const child of node.children) {
      const childResults = await this.searchInTree(child, query);
      results.push(...childResults);
    }

    return results;
  }

  private calculateRelevance(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    let matchCount = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matchCount++;
      }
    }
    
    return matchCount / queryWords.length;
  }
}

export const pageIndexService = new PageIndexService();
