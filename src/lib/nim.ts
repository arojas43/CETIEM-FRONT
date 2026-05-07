/**
 * Servicio NVIDIA NIM para inferencia LLM y embeddings.
 * Todos los modelos usan el endpoint OpenAI-compatible de NVIDIA.
 *
 * Modelos configurables vía env:
 *   NVIDIA_CHAT_MODEL          — LLM general (default: meta/llama-3.1-70b-instruct)
 *   NVIDIA_DEEPSEEK_MODEL      — DeepSeek V4 Flash, 1M contexto, no-thinking
 *   NVIDIA_EMBEDDING_MODEL     — Embeddings (default: nvidia/llama-3.2-nemoretriever-300m-embed-v1)
 *   NVIDIA_QA_API_KEY          — Clave separada para QA (opcional)
 *   NVIDIA_INTENT_API_KEY      — Clave separada para extracción de intención
 */
export class NIMService {
  private apiKey: string;
  private embeddingModel: string;
  private baseUrl: string = "https://integrate.api.nvidia.com/v1";

  constructor() {
    this.apiKey = process.env.NVIDIA_API_KEY || "";
    this.embeddingModel =
      process.env.NVIDIA_EMBEDDING_MODEL ||
      "nvidia/llama-3.2-nemoretriever-300m-embed-v1";
  }

  private withTimeout(ms: number): AbortSignal {
    return AbortSignal.timeout(ms);
  }

  // Reintenta fetch hasta 3 veces en caso de 429, con espera exponencial
  private async fetchWithRetry(url: string, init: RequestInit, retries = 3): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const res = await fetch(url, init);
      if (res.status !== 429 || attempt === retries) return res;
      const wait = attempt * 30_000; // 30s, 60s, 90s
      console.warn(`[NIM] 429 — reintentando en ${wait / 1000}s (intento ${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, wait));
    }
    return fetch(url, init); // never reached
  }

  // ── Embeddings ─────────────────────────────────────────────────────────────

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      signal: this.withTimeout(30_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: this.embeddingModel,
        encoding_format: "float",
        input_type: "query",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`NIM embeddings error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!data.data?.[0]?.embedding) {
      throw new Error(
        `NIM embedding response malformed: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
    return data.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      signal: this.withTimeout(60_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: this.embeddingModel,
        encoding_format: "float",
        input_type: "passage",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`NIM embeddings error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.data)) {
      throw new Error(
        `NIM embeddings response malformed: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
    return data.data.map((item: any) => item.embedding);
  }

  // ── Chat/completions ───────────────────────────────────────────────────────

  /**
   * Llamada genérica a cualquier modelo NIM.
   * Usar `generateWithDeepSeek` para el modelo de extracción masiva.
   */
  async generateText(options: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    apiKey?: string;
    timeoutMs?: number;
  }): Promise<string> {
    const {
      model,
      prompt,
      systemPrompt,
      maxTokens = 4096,
      temperature = 0.2,
      apiKey,
      timeoutMs = 90_000,
    } = options;

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: this.withTimeout(timeoutMs + 200_000), // ampliar timeout para cubrir reintentos
      headers: {
        Authorization: `Bearer ${apiKey || this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`NIM ${model} error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error(
        `NIM chat response malformed: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
    return content;
  }

  /**
   * Llamada a DeepSeek V4 Flash (1M tokens de contexto).
   * - Thinking desactivado vía extra_body.chat_template_kwargs.thinking = false
   *   (configuración correcta de NIM — no a través del system prompt).
   * - Útil para procesar documentos completos o batches grandes de chunks.
   */
  async generateWithDeepSeek(options: {
    userPrompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    apiKey?: string;
    model?: string;
  }): Promise<string> {
    const {
      userPrompt,
      systemPrompt,
      maxTokens = 8192,
      temperature = 0.1,
      apiKey,
    } = options;

    // kimi-k2.6 por defecto — 1M ctx, 446ms, sin parámetros thinking especiales
    const model = options.model ||
      process.env.NVIDIA_DEEPSEEK_MODEL || "moonshotai/kimi-k2.6";

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    // chat_template_kwargs sólo para modelos DeepSeek que soportan thinking mode
    const isDeepSeek = model.includes("deepseek");
    const extraParams = isDeepSeek ? { chat_template_kwargs: { thinking: false } } : {};

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: this.withTimeout(500_000),
      headers: {
        Authorization: `Bearer ${apiKey || this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.95,
        ...extraParams,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`NIM ${model} error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error(
        `NIM ${model} response malformed: ${JSON.stringify(data).slice(0, 200)}`
      );
    }
    return content;
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────

  cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const nimService = new NIMService();
