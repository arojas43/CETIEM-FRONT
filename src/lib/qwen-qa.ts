/**
 * Servicio de NVIDIA NIM para Q&A con Qwen 3.5 122B
 * Especializado en generación de respuestas con contexto extenso (16K tokens)
 */

export class QwenQAService {
  private apiKey: string;
  private model: string;
  private baseUrl: string = "https://integrate.api.nvidia.com/v1";

  constructor() {
    this.apiKey = process.env.NVIDIA_QA_API_KEY || "";
    this.model = "qwen/qwen3.5-122b-a10b";
  }

  /**
   * Genera respuesta para Q&A usando contexto combinado de PageIndex + FalkorDB
   */
  async generateAnswer(options: {
    question: string;
    pageIndexContext: string;
    entities: Array<{ type: string; name: string; description?: string; page?: number }>;
    relations: Array<{ source: string; type: string; target: string }>;
    documentName: string;
  }): Promise<string> {
    const { question, pageIndexContext, entities, relations, documentName } = options;

    // Construir contexto estructurado
    const entitiesText = entities.length > 0
      ? '## Entidades Encontradas en el Grafo de Conocimiento:\n' + 
        entities.map(e => `- **${e.type}**: ${e.name}${e.description ? ` (${e.description})` : ''}${e.page ? ` [pág. ${e.page}]` : ''}`).join('\n')
      : '';

    const relationsText = relations.length > 0
      ? '\n## Relaciones entre Entidades:\n' + 
        relations.map(r => `- ${r.source} → **${r.type}** → ${r.target}`).join('\n')
      : '';

    const pageIndexText = pageIndexContext
      ? '\n## Contenido del Documento (PageIndex):\n' + pageIndexContext
      : '';

    // Construir prompt optimizado para Qwen
    const systemPrompt = `Eres un asistente experto en análisis documental. Tu tarea es responder preguntas sobre documentos utilizando ÚNICAMENTE la información proporcionada.

Instrucciones:
1. Responde basándote EXCLUSIVAMENTE en el contexto proporcionado (PageIndex + Grafo de Conocimiento)
2. Si la pregunta es sobre una página específica y esa página está en el contexto, proporciona esa información primero
3. Cita las páginas cuando sea relevante (ej: "En la página 4 se describe...")
4. Si no encuentras información suficiente, indícalo claramente
5. Proporciona respuestas estructuradas y fáciles de leer
6. Usa formato Markdown para mejorar la legibilidad
7. Mantén un tono profesional pero accesible`;

    const userPrompt = `Documento: ${documentName}

${pageIndexText}

${entitiesText}
${relationsText}

---
Pregunta del usuario: ${question}

---
Responde la pregunta utilizando ÚNICAMENTE la información anterior. Si mencionas información específica, indica la página cuando esté disponible.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 4096,  // Respuestas detalladas
          temperature: 0.6,   // Balance entre creatividad y precisión
          top_p: 0.95,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content || "No se pudo generar una respuesta.";
    } catch (error: any) {
      console.error('[QwenQA] Error generando respuesta:', error.message);
      
      // Fallback a NIM service normal si Qwen falla
      const { nimService } = await import('./nim');
      return nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || 'meta/llama-3.1-70b-instruct',
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        maxTokens: 1024,
        temperature: 0.3,
      });
    }
  }

  /**
   * Genera respuesta para preguntas complejas que requieren razonamiento
   */
  async generateComplexAnswer(options: {
    question: string;
    context: string;
    documentName: string;
    followUp?: boolean;
  }): Promise<string> {
    const { question, context, documentName, followUp } = options;

    const systemPrompt = `Eres un asistente experto en análisis de documentos técnicos y científicos.
    
Capacidades:
- Razonamiento complejo sobre información técnica
- Síntesis de información de múltiples fuentes
- Identificación de relaciones implícitas
- Explicaciones claras de conceptos complejos

Instrucciones:
1. Analiza el contexto proporcionado en profundidad
2. Identifica información relevante para la pregunta
3. Si la pregunta requiere inferencia, explica tu razonamiento paso a paso
4. Usa ejemplos del documento cuando sea relevante
5. Si hay información contradictoria, menciónalo
6. Proporciona referencias a páginas/secciones cuando estén disponibles`;

    const userPrompt = `Documento: ${documentName}

${followUp ? '(Esta es una pregunta de seguimiento sobre el documento anterior)' : ''}

Contexto del documento:
${context}

---
Pregunta: ${question}

---
Proporciona una respuesta completa y bien razonada.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 8192,  // Respuestas muy detalladas
          temperature: 0.7,   // Más creativo para razonamiento complejo
          top_p: 0.95,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Qwen API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content || "No se pudo generar una respuesta.";
    } catch (error: any) {
      console.error('[QwenQA] Error en respuesta compleja:', error.message);
      return "Error al generar respuesta. Por favor, intenta de nuevo.";
    }
  }
}

export const qwenQAService = new QwenQAService();
