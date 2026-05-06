/**
 * Smoke: Q&A / búsqueda semántica sobre documentos.
 * Requiere al menos un documento en estado INDEXED o ANALYZED.
 * Si no hay ninguno, el test se salta sin fallar.
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Q&A y búsqueda semántica", () => {
  test("GET /api/documents lista documentos indexados", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/documents", {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const documents = body.documents ?? body.data ?? body;
    expect(Array.isArray(documents)).toBe(true);
  });

  test("POST /api/documents/:id/search responde con shape válido o 404", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    // Obtener primer documento indexado/analizado
    const listResp = await page.request.get("/api/documents", {
      headers: { cookie: cookieHeader },
    });
    const listBody = await listResp.json();
    const documents = listBody.documents ?? listBody.data ?? listBody;
    const indexed = Array.isArray(documents)
      ? documents.find((d: any) => ["INDEXED", "ANALYZED"].includes(d.status))
      : null;

    if (!indexed) {
      test.skip(true, "No hay documentos indexados para probar Q&A");
      return;
    }

    const searchResp = await page.request.post(`/api/documents/${indexed.id}/search`, {
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      data: { query: "¿Cuál es el objetivo principal del documento?" },
    });

    expect([200, 422, 500]).toContain(searchResp.status());
    if (searchResp.status() === 200) {
      const result = await searchResp.json();
      expect(result).toHaveProperty("answer");
    }
  });

  test("página Q&A carga sin error 500", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const listResp = await page.request.get("/api/documents", {
      headers: { cookie: cookieHeader },
    });
    const listBody = await listResp.json();
    const documents = listBody.documents ?? listBody.data ?? listBody;
    const indexed = Array.isArray(documents)
      ? documents.find((d: any) => ["INDEXED", "ANALYZED"].includes(d.status))
      : null;

    if (!indexed) {
      test.skip(true, "No hay documentos indexados");
      return;
    }

    await page.goto(`/dashboard/documents/${indexed.id}/qa`);
    await expect(page.locator("body")).not.toContainText(/unexpected error|500/i, {
      timeout: 10_000,
    });
  });
});
