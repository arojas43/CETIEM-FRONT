/**
 * Servicio de NVIDIA NIM para Q&A con Qwen 3.5 122B
 * Usa streaming + enable_thinking para razonamiento extendido
 */

export class QwenQAService {
  private apiKey: string;
  private model: string;
  private baseUrl: string = "https://integrate.api.nvidia.com/v1";

  constructor() {
    this.apiKey = process.env.NVIDIA_QA_API_KEY || "";
    this.model = "z-ai/glm4.7";
  }

  /**
   * Consume un stream SSE de NVIDIA y devuelve el texto completo.
   * Filtra los tokens de pensamiento (<think>...</think>) del resultado final.
   */
  private async consumeStream(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream in response");

    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) full += delta;
        } catch {
          // línea incompleta o vacía — ignorar
        }
      }
    }

    // Qwen con enable_thinking devuelve <think>…</think> antes de la respuesta.
    // Lo eliminamos para devolver solo la respuesta limpia al usuario.
    return full.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
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

    const entitiesText = entities.length > 0
      ? "## Entidades del Grafo de Conocimiento:\n" +
        entities.map(e =>
          `- **${e.type}**: ${e.name}${e.description ? ` (${e.description})` : ""}${e.page ? ` [pág. ${e.page}]` : ""}`
        ).join("\n")
      : "";

    const relationsText = relations.length > 0
      ? "\n## Relaciones entre Entidades:\n" +
        relations.map(r => `- ${r.source} → **${r.type}** → ${r.target}`).join("\n")
      : "";

    const pageIndexText = pageIndexContext
      ? "\n## Contenido del Documento (PageIndex):\n" + pageIndexContext
      : "";

    const systemPrompt = `Eres un asistente experto en análisis documental. Responde preguntas sobre documentos utilizando ÚNICAMENTE la información proporcionada.

Instrucciones:
1. Basate EXCLUSIVAMENTE en el contexto dado (PageIndex + Grafo de Conocimiento)
2. Si la pregunta menciona una página específica, responde primero con esa información
3. Cita páginas cuando sea relevante: "En la página 4..."
4. Si no hay información suficiente, indícalo claramente
5. Usa Markdown para estructurar la respuesta
6. Mantén un tono profesional`;

    const userPrompt = `Documento: ${documentName}
${pageIndexText}
${entitiesText}
${relationsText}

---
Pregunta: ${question}

Responde usando ÚNICAMENTE la información anterior. Indica la página cuando esté disponible.`;

    const doFetch = () => fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 16384,
        temperature: 1,
        top_p: 1,
        stream: true,
        chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
      }),
    });

    try {
      let response = await doFetch().catch(async (e) => {
        // Reintento único ante errores de red (fetch failed, ECONNRESET, etc.)
        console.warn("[QwenQA] Error de red, reintentando en 2s...", e.message);
        await new Promise(r => setTimeout(r, 2000));
        return doFetch();
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API error ${response.status}: ${errorText}`);
      }

      const answer = await this.consumeStream(response);
      return answer || "No se pudo generar una respuesta.";
    } catch (error: any) {
      console.error("[QwenQA] Error generando respuesta:", error.message);

      // Fallback a Llama 3.1 si Qwen falla
      const { nimService } = await import("./nim");
      return nimService.generateText({
        model: process.env.NVIDIA_CHAT_MODEL || "meta/llama-3.1-70b-instruct",
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 2048,
        temperature: 0.3,
      });
    }
  }

  /**
   * Genera respuesta para preguntas complejas que requieren razonamiento profundo
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

Instrucciones:
1. Analiza el contexto en profundidad
2. Identifica información relevante para la pregunta
3. Si la pregunta requiere inferencia, explica tu razonamiento
4. Usa ejemplos del documento cuando sea relevante
5. Proporciona referencias a páginas/secciones cuando estén disponibles`;

    const userPrompt = `Documento: ${documentName}
${followUp ? "\n(Pregunta de seguimiento sobre el documento)\n" : ""}
Contexto:
${context}

---
Pregunta: ${question}

Proporciona una respuesta completa y bien razonada.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 16384,
          temperature: 1,
          top_p: 1,
          stream: true,
          chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
        }),
      });

      if (!response.ok) {
        throw new Error(`Qwen API error: ${response.status}`);
      }

      const answer = await this.consumeStream(response);
      return answer || "No se pudo generar una respuesta.";
    } catch (error: any) {
      console.error("[QwenQA] Error en respuesta compleja:", error.message);
      return "Error al generar respuesta. Por favor, intenta de nuevo.";
    }
  }
}

export const qwenQAService = new QwenQAService();
