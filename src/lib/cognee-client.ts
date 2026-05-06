/**
 * Cliente TypeScript para el microservicio Cognee Python.
 * Llama a la API REST de Cognee (uvicorn cognee.api.client) en lugar de
 * reimplementar la extracción de entidades y embeddings en TypeScript.
 *
 * Rutas usadas:
 *   POST /api/v1/add      — agrega chunks de texto a un dataset
 *   POST /api/v1/cognify  — construye el grafo de conocimiento (LLM + embeddings → FalkorDB)
 *   POST /api/v1/search   — búsqueda semántica en el grafo
 *   GET  /health          — healthcheck
 */

export interface CogneeSearchResult {
  answer: string;
  context: string;
  entities: Array<{ id: string; type: string; name: string; description?: string }>;
  sources: Array<{ section?: string; page?: number; documentId?: string }>;
}

class CogneeClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor() {
    this.baseUrl = (process.env.COGNEE_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
    this.timeout = 120_000;
  }

  get available(): boolean {
    return !!process.env.COGNEE_SERVICE_URL;
  }

  private signal() {
    return AbortSignal.timeout(this.timeout);
  }

  /** Agrega un conjunto de chunks de texto a un dataset (documentId como nombre). */
  async addChunks(documentId: string, chunks: Array<{ title: string; content: string; page?: number }>): Promise<void> {
    const text = chunks
      .map(c => `## ${c.title}\n\n${c.content}`)
      .join('\n\n---\n\n');

    const form = new FormData();
    // Cognee 1.0 uses `data` for files and `datasetName` for the dataset name
    form.append('data', new Blob([text], { type: 'text/plain' }), `${documentId}.txt`);
    form.append('datasetName', documentId);

    const res = await fetch(`${this.baseUrl}/api/v1/add`, {
      method: 'POST',
      signal: this.signal(),
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Cognee /add failed ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  /**
   * Dispara la construcción del grafo de conocimiento para el dataset.
   * Cognee internamente: chunking → NIM LLM entity extraction → NIM embeddings → FalkorDB.
   */
  async cognify(documentId: string): Promise<{ entities: number }> {
    const res = await fetch(`${this.baseUrl}/api/v1/cognify`, {
      method: 'POST',
      signal: AbortSignal.timeout(600_000), // cognify puede tardar mucho
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datasets: [documentId] }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Cognee /cognify failed ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json().catch(() => ({}));
    return { entities: data?.entities_count ?? data?.entity_count ?? 0 };
  }

  /**
   * Búsqueda semántica en el grafo de conocimiento del documento.
   * La respuesta de Cognee 1.0 es List[SearchResult] donde cada item tiene
   * { search_result, dataset_id, dataset_name }.
   * Con GRAPH_COMPLETION, search_result es la respuesta del LLM como string.
   */
  async search(
    query: string,
    documentId: string,
    topK = 10
  ): Promise<CogneeSearchResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/search`, {
      method: 'POST',
      signal: this.signal(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_type: 'GRAPH_COMPLETION',
        query,
        datasets: [documentId],
        top_k: topK,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Cognee /search failed ${res.status}: ${body.slice(0, 200)}`);
    }

    // Cognee 1.0: returns List[SearchResult] — each has { search_result, dataset_id, dataset_name }
    const results: Array<{ search_result: any; dataset_id?: string; dataset_name?: string }> = await res.json();
    const first = results?.[0];

    // GRAPH_COMPLETION: search_result is the LLM answer string
    // RAG_COMPLETION: search_result may be a list of context chunks
    let answer = '';
    let context = '';
    const entities: CogneeSearchResult['entities'] = [];

    if (typeof first?.search_result === 'string') {
      answer = first.search_result;
    } else if (Array.isArray(first?.search_result)) {
      // context-only or entity list
      const items = first.search_result as any[];
      answer = items.map(i => (typeof i === 'string' ? i : i?.text ?? i?.content ?? JSON.stringify(i))).join('\n\n');
    }

    // Collect all search_results as context
    context = results
      .map(r => (typeof r.search_result === 'string' ? r.search_result : JSON.stringify(r.search_result)))
      .join('\n\n');

    return { answer, context, entities, sources: [] };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const cogneeClient = new CogneeClient();
