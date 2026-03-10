/**
 * Servicio de NVIDIA NIM para inferencia de modelos de lenguaje
 * Utiliza el endpoint de NVIDIA API para embeddings y generación de texto
 */
export class NIMService {
  private apiKey: string;
  private embeddingModel: string;
  private baseUrl: string = "https://integrate.api.nvidia.com/v1";

  constructor() {
    this.apiKey = process.env.NVIDIA_API_KEY || "";
    this.embeddingModel = process.env.NVIDIA_EMBEDDING_MODEL || "llama-3_2-nemoretriever-300m-embed-v1";
  }

  /**
   * Genera embeddings para un texto dado
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: this.embeddingModel,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Genera embeddings para múltiples textos (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: this.embeddingModel,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  /**
   * Genera texto usando un modelo de lenguaje
   */
  async generateText(options: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const { model, prompt, systemPrompt, maxTokens = 1024, temperature = 0.7 } = options;

    const messages: any[] = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Calcula la similitud de coseno entre dos vectores
   */
  cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const nimService = new NIMService();
