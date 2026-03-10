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
  private useLocal: boolean;
  private pdfjsLib: any;

  constructor() {
    this.useLocal = !process.env.PAGEINDEX_API_KEY || process.env.PAGEINDEX_LOCAL_MODE === "true";
    this.pdfjsLib = null;
  }

  /**
   * Carga pdfjs-dist dinámicamente (solo en runtime, no en build)
   */
  private async loadPdfjs(): Promise<any> {
    if (!this.pdfjsLib) {
      // Polyfill para DOMMatrix (requerido por pdfjs-dist en Node.js)
      if (typeof globalThis.DOMMatrix === 'undefined') {
        (globalThis as any).DOMMatrix = class DOMMatrix {
          m11: number = 1; m12: number = 0; m13: number = 0; m14: number = 0;
          m21: number = 0; m22: number = 1; m23: number = 0; m24: number = 0;
          m31: number = 0; m32: number = 0; m33: number = 1; m34: number = 0;
          m41: number = 0; m42: number = 0; m43: number = 0; m44: number = 1;
          multiply(other: any) { return this; }
          invertSelf() { return this; }
          inverse() { return this; }
          transformPoint(point: any) { return point; }
          toFloat32Array() { return new Float32Array(16); }
          toFloat64Array() { return new Float64Array(16); }
          toString() { return 'matrix(1,0,0,1,0,0)'; }
        };
      }
      
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      this.pdfjsLib = require('pdfjs-dist');
      this.pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
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
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      // Limpiar texto
      return text
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
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

      // Extraer JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
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

    // Paso 4: Crear nodos para cada sección detectada
    const nodes: PageIndexNode[] = [];
    
    if (structure.sections.length > 0) {
      // Hay secciones detectadas - crear árbol jerárquico
      for (const section of structure.sections) {
        const node = this.createNodeFromSection(section, text, pages, root.id);
        nodes.push(node);
        root.children.push(node);
      }
      console.log(`[PageIndex] Árbol creado con ${nodes.length} secciones`);
    } else {
      // No hay secciones - dividir por páginas (fallback)
      console.log('[PageIndex] No se detectaron secciones, usando fallback por páginas...');
      pages.forEach((pageText, index) => {
        const node: PageIndexNode = {
          id: crypto.randomUUID(),
          level: 1,
          title: `Página ${index + 1}`,
          page: index + 1,
          endPage: index + 1,
          content: pageText.slice(0, 3000),
          children: [],
          parentId: root.id,
        };
        nodes.push(node);
        root.children.push(node);
      });
    }

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
    fullText: string,
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
      content: sectionContent.slice(0, 5000), // Máximo 5000 chars por nodo
      summary: section.summary,
      children: [],
      parentId,
      metadata: {
        extractedAt: new Date().toISOString(),
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
