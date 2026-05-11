/**
 * Cliente TypeScript para el microservicio OpenKB (openkb-api/).
 *
 * OpenKB construye un KB wiki-style por empresa (un directorio por companyId).
 * Esto permite razonamiento cross-documento: el assessor puede buscar en todos
 * los documentos de una empresa a la vez.
 *
 * Endpoints del microservicio:
 *   POST   /api/v1/add                      — indexar documento en el KB
 *   DELETE /api/v1/documents/{id}           — eliminar documento del KB
 *   POST   /api/v1/search                   — Q&A sobre el KB
 *   GET    /health                          — healthcheck
 */

const BASE_URL = (process.env.OPENKB_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');

export interface OpenKBSearchResult {
  answer: string;
  sources: { section?: string; page?: number; documentId?: string }[];
}

class OpenKBClient {
  get available(): boolean {
    return !!process.env.OPENKB_SERVICE_URL;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Indexa el contenido de un documento en el KB de la empresa.
   * El KB es por companyId — OpenKB hace razonamiento cross-documento.
   * Nombre del archivo: <documentId>.txt para que el hash de deduplicación
   * sea por documento y evite reindexar si el contenido no cambió.
   */
  async addDocument(companyId: string, documentId: string, text: string): Promise<void> {
    const blob = new Blob([text], { type: 'text/plain' });
    const form = new FormData();
    form.append('data', blob, `${documentId}.txt`);
    form.append('datasetName', companyId);

    const res = await fetch(`${BASE_URL}/api/v1/add`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(300_000), // hasta 5 min para docs grandes
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenKB add failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }

  /**
   * Elimina un documento del KB de la empresa.
   * Llamar antes de re-indexar si el contenido cambió, para evitar
   * acumulación de páginas wiki obsoletas (OpenKB no limpia automáticamente).
   */
  async deleteDocument(companyId: string, documentId: string): Promise<void> {
    const res = await fetch(
      `${BASE_URL}/api/v1/documents/${documentId}?datasetName=${encodeURIComponent(companyId)}`,
      { method: 'DELETE', signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenKB delete failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }

  /**
   * Q&A sobre el KB de una empresa.
   * Busca en todos los documentos de la empresa (cross-documento).
   */
  async search(query: string, companyId: string): Promise<OpenKBSearchResult> {
    const res = await fetch(`${BASE_URL}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, datasets: [companyId], top_k: 10 }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenKB search failed (${res.status}): ${detail.slice(0, 200)}`);
    }

    const results: { search_result: string; dataset_id: string }[] = await res.json();
    const answer = results.map(r => r.search_result).filter(Boolean).join('\n\n');
    return { answer, sources: [] };
  }
}

export const openKBClient = new OpenKBClient();
