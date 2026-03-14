// Importar extracción de PDF
import { extractTextFromPDF } from "./pdf-extract";

// Importar OCR
import { processPdfWithOcr } from "./ocr";

import { nimService } from "./nim";

/**
 * Implementación local de PageIndex para procesamiento de documentos PDF
 */

export interface PageIndexNode {
  id: string;
  level: number;
  title: string;
  content?: string;
  page?: number;
  endPage?: number;        // Página final de la sección (para búsquedas de rango en Q&A)
  start_index?: number;    // Offset de inicio en el documento (compatible con PageIndex oficial)
  end_index?: number;      // Offset de fin en el documento (compatible con PageIndex oficial)
  summary?: string;        // Resumen generado por LLM (compatible con PageIndex oficial)
  node_id?: string;        // ID único para tracking (compatible con PageIndex oficial)
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

  constructor() {
    this.useLocal = !process.env.PAGEINDEX_API_KEY || process.env.PAGEINDEX_LOCAL_MODE === "true";
  }

  /**
   * Extrae texto de un PDF (con OCR automático si es necesario)
   */
  async extractText(pdfBuffer: Buffer): Promise<{ text: string; pages: string[]; requiresOcr?: boolean; ocrConfidence?: number }> {
    const result = await extractTextFromPDF(pdfBuffer);
    
    // Si el PDF requiere OCR, procesar con Tesseract
    if (result.requiresOcr) {
      console.log('[PageIndex] PDF escaneado detectado, aplicando OCR...');
      
      try {
        const ocrResult = await processPdfWithOcr(pdfBuffer, 'spa');
        
        return {
          text: ocrResult.text,
          pages: ocrResult.pages,
          requiresOcr: false,
          ocrConfidence: ocrResult.ocrConfidence,
        };
      } catch (error: any) {
        console.error('[PageIndex] Error en OCR:', error.message);
        // Usar resultado original aunque no tenga texto
      }
    }
    
    // Crear páginas (una por página del PDF)
    const pages = [];
    for (let i = 0; i < result.numpages; i++) {
      pages.push(`Página ${i + 1} de ${result.numpages}\n\n${result.text.slice(0, 1000)}`);
    }

    return {
      text: result.text,
      pages: pages.length > 0 ? pages : ['Página 1'],
      requiresOcr: result.requiresOcr,
      ocrConfidence: 0,
    };
  }

  /**
   * Detecta la estructura jerárquica del documento usando LLM con TOC detection
   * Compatible con PageIndex oficial: busca tabla de contenido en primeras páginas
   */
  async detectStructure(text: string): Promise<{
    title: string;
    sections: Array<{ title: string; level: number; startPage?: number }>;
  }> {
    // Paso 1: Intentar detectar TOC (Table of Contents) en las primeras páginas
    const tocResult = await this.detectTOC(text);
    
    if (tocResult && tocResult.sections.length > 0) {
      console.log('[PageIndex] TOC detectado exitosamente');
      return tocResult;
    }

    console.log('[PageIndex] TOC no detectado, usando detección por patrones');
    
    // Paso 2: Detección por patrones de texto (números de sección, mayúsculas, etc.)
    const patternResult = this.detectStructureByPatterns(text);
    
    if (patternResult && patternResult.sections.length > 0) {
      return patternResult;
    }

    // Paso 3: Fallback a LLM
    console.log('[PageIndex] Usando LLM para detección de estructura');
    return this.detectStructureWithLLM(text);
  }

  /**
   * Detecta Tabla de Contenidos en las primeras páginas del documento
   */
  async detectTOC(text: string): Promise<{
    title: string;
    sections: Array<{ title: string; level: number; startPage?: number }>;
  } | null> {
    // Extraer primeras 3000 caracteres donde suele estar el TOC
    const tocCandidate = text.slice(0, 3000);
    
    // Patrones comunes de TOC
    const tocPatterns = [
      /tabla\s*(de\s*)?contenido/i,
      /índice/i,
      /contents/i,
      /table\s*of\s*contents/i,
      /sumario/i,
    ];

    const hasTOC = tocPatterns.some(pattern => pattern.test(tocCandidate));
    
    if (!hasTOC) {
      return null;
    }

    // Patrones para extraer entradas del TOC
    const entryPatterns = [
      // "Capítulo 1: Introducción ............ 5"
      /^(Capítulo|Cap\.|Sección|Sec\.|Parte|Artículo|Art\.|Título)\s*(\d+[a-z]?)[:\s]+(.+?)[\. ]+(\d+)$/im,
      // "1.1 Subsección ........ 10"
      /^(\d+([\.]\d+)*)\s+(.+?)[\. ]+(\d+)$/im,
      // "Introducción ........................ 1"
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[\. ]+(\d+)$/im,
    ];

    const sections: Array<{ title: string; level: number; startPage?: number }> = [];
    const lines = tocCandidate.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      // Saltar líneas que son títulos del TOC
      if (tocPatterns.some(p => p.test(line))) continue;

      for (const pattern of entryPatterns) {
        const match = line.match(pattern);
        if (match) {
          const level = match[1] && /^\d/.test(match[1]) 
            ? (match[1].split('.').length) 
            : 1;
          
          const title = match[3] || match[1];
          const page = parseInt(match[match.length - 1]);

          sections.push({
            title: title.trim().replace(/[\. ]+$/, ''),
            level: Math.min(level, 4), // Máximo 4 niveles
            startPage: isNaN(page) ? undefined : page,
          });
          break;
        }
      }
    }

    if (sections.length > 0) {
      // Intentar detectar título del documento
      const titleMatch = text.match(/^([^\n]{1,100})/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Documento';

      return { title, sections };
    }

    return null;
  }

  /**
   * Detecta estructura por patrones de texto (números, mayúsculas, etc.)
   */
  detectStructureByPatterns(text: string): {
    title: string;
    sections: Array<{ title: string; level: number; startPage?: number }>;
  } | null {
    const sections: Array<{ title: string; level: number; startPage?: number }> = [];
    
    // Patrones de encabezados numerados
    const headingPatterns = [
      // "CAPÍTULO 1" o "CAPÍTULO I"
      { pattern: /^(CAPÍTULO|TÍTULO|SECCIÓN|PARTE)\s+([IVX0-9]+|[0-9]+)(?:[:\s.-]+(.*))?$/im, level: 1 },
      // "1." o "1.1" o "1.1.1"
      { pattern: /^(\d+(?:\.\d+)*)\s+(.+)$/im, level: 2 },
      // "A." o "A.1"
      { pattern: /^([A-Z](?:\.\d+)?)\s+(.+)$/im, level: 2 },
      // "Artículo 1" o "Art. 1"
      { pattern: /^(Artículo|Art\.?)\s+(\d+)(?:[:\s.-]+(.*))?$/im, level: 1 },
    ];

    const lines = text.split('\n');
    let currentPage = 1;
    const charsPerPage = Math.ceil(text.length / 50); // Estimado

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const { pattern, level } of headingPatterns) {
        const match = line.match(pattern);
        if (match) {
          let title = match[3] || match[2] || match[0];
          title = title.trim();
          
          // Calcular página aproximada
          const charPosition = text.indexOf(line);
          const estimatedPage = Math.floor(charPosition / charsPerPage) + 1;

          sections.push({
            title,
            level,
            startPage: estimatedPage,
          });
          break;
        }
      }
    }

    if (sections.length > 0) {
      const titleMatch = text.match(/^([^\n]{1,100})/m);
      const title = titleMatch ? titleMatch[1].trim() : 'Documento';

      return { title, sections };
    }

    return null;
  }

  /**
   * Detecta estructura usando LLM (fallback)
   */
  async detectStructureWithLLM(text: string): Promise<{
    title: string;
    sections: Array<{ title: string; level: number; startPage?: number }>;
  }> {
    const prompt = `Analiza el siguiente texto y detecta su estructura jerárquica.
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "title": "Título principal del documento",
  "sections": [
    {"title": "Nombre de sección", "level": 1, "startPage": 1},
    {"title": "Subsección", "level": 2, "startPage": 3}
  ]
}

Texto a analizar:
${text.slice(0, 15000)}`;

    try {
      const response = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
        prompt,
        systemPrompt: "Eres un experto en análisis documental. Extrae estructuras jerárquicas de documentos.",
        maxTokens: 2000,
        temperature: 0.3,
      });

      // Extraer JSON de la respuesta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // JSON inválido, usar fallback
        }
      }

      // Fallback: estructura simple
      return {
        title: "Documento",
        sections: [],
      };
    } catch (error) {
      console.error("Error detecting structure:", error);
      return {
        title: "Documento",
        sections: [],
      };
    }
  }

  /**
   * Construye un índice jerárquico a partir de un PDF con offsets y summaries
   * Compatible con especificación PageIndex oficial
   */
  async buildIndex(
    documentId: string,
    pdfBuffer: Buffer,
    name: string
  ): Promise<PageIndexDocument> {
    // Extraer texto del PDF (con OCR automático)
    const { text, pages, requiresOcr, ocrConfidence } = await this.extractText(pdfBuffer);

    // Detectar estructura
    const structure = await this.detectStructure(text);

    // Calcular offsets globales
    let currentIndex = 0;

    // Crear nodo raíz con offsets
    const root: PageIndexNode = {
      id: crypto.randomUUID(),
      node_id: "root-0000",
      level: 0,
      title: structure.title,
      content: text.slice(0, 5000),
      start_index: 0,
      end_index: text.length,
      summary: await this.generateSummary(text.slice(0, 3000), structure.title),
      children: [],
      metadata: { requiresOcr, ocrConfidence },
    };

    // Crear nodos para cada sección
    const nodes: PageIndexNode[] = [];

    for (const section of structure.sections) {
      // Buscar posición aproximada de la sección en el texto
      let sectionStart = text.indexOf(section.title) || currentIndex;
      const nextSectionIndex = structure.sections.indexOf(section) + 1;
      const nextSection = structure.sections[nextSectionIndex];
      let sectionEnd = nextSection
        ? text.indexOf(nextSection.title)
        : text.length;

      if (sectionEnd === -1) sectionEnd = text.length;
      if (sectionStart === -1 || sectionStart < 0) {
        sectionStart = currentIndex;
        sectionEnd = currentIndex + 2000;
      }

      const sectionContent = text.slice(sectionStart, sectionEnd);

      const node: PageIndexNode = {
        id: crypto.randomUUID(),
        node_id: `node-${String(nodes.length).padStart(4, '0')}`,
        level: section.level,
        title: section.title,
        page: section.startPage,
        content: sectionContent.slice(0, 5000),
        start_index: sectionStart,
        end_index: sectionEnd,
        summary: await this.generateSummary(sectionContent.slice(0, 2000), section.title),
        children: [],
        parentId: root.id,
      };

      nodes.push(node);
      root.children.push(node);
      currentIndex = sectionEnd;
    }

    // Si no hay secciones detectadas, dividir por páginas con offsets
    if (structure.sections.length === 0) {
      const charsPerPage = Math.ceil(text.length / pages.length);

      // Usar for loop en lugar de forEach para poder usar await
      for (let index = 0; index < pages.length; index++) {
        const pageText = pages[index];
        const pageStart = index * charsPerPage;
        const pageEnd = Math.min((index + 1) * charsPerPage, text.length);

        const node: PageIndexNode = {
          id: crypto.randomUUID(),
          node_id: `page-${String(index).padStart(4, '0')}`,
          level: 1,
          title: `Página ${index + 1}`,
          page: index + 1,
          content: pageText.slice(0, 2000),
          start_index: pageStart,
          end_index: pageEnd,
          summary: await this.generateSummary(pageText.slice(0, 1000), `Página ${index + 1}`),
          children: [],
          parentId: root.id,
        };

        nodes.push(node);
        root.children.push(node);
      }
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
   * Genera un resumen conciso de un fragmento de texto usando LLM
   */
  async generateSummary(text: string, title: string): Promise<string> {
    const prompt = `Resume en UNA sola oración (máximo 20 palabras) el siguiente fragmento del documento "${title}":

Fragmento:
${text.slice(0, 1500)}

Resumen:`;

    try {
      const response = await nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
        prompt,
        systemPrompt: "Eres un experto en resumir documentos. Crea resúmenes concisos y precisos.",
        maxTokens: 50,
        temperature: 0.3,
      });

      return response.trim().slice(0, 200);
    } catch (error) {
      // Fallback: usar primeras 200 caracteres
      return text.slice(0, 200) + (text.length > 200 ? '...' : '');
    }
  }

  /**
   * Aplanar todos los nodos del índice
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
   * Realiza una consulta sobre el índice
   */
  async query(index: PageIndexDocument, query: string): Promise<any> {
    return {
      query,
      results: [],
      context: '',
    };
  }
}

export interface QueryResult {
  query: string;
  results: any[];
  context: string;
}

export interface SearchResult {
  nodeId: string;
  title: string;
  content?: string;
  page?: number;
  relevance: number;
  path: string[];
}

export const pageIndexService = new PageIndexService();
