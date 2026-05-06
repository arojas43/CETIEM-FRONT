/**
 * Smoke: procesamiento y progreso de documentos.
 * El test sube un PDF mínimo, verifica que cambia de estado y que
 * el endpoint /progress devuelve estructura válida.
 * No espera que el análisis Cognee+NIM se complete (requiere servicios externos).
 */
import { test, expect } from "@playwright/test";
import { login, minimalPDF } from "./helpers";

test.describe("Procesamiento de documentos", () => {
  let documentId: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "company");

    const cookies = await ctx.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.post("/api/documents", {
      headers: { cookie: cookieHeader },
      multipart: {
        file: {
          name: `smoke-processing-${Date.now()}.pdf`,
          mimeType: "application/pdf",
          buffer: minimalPDF(Date.now()),
        },
      },
    });
    const body = await resp.json();
    documentId = body.id;
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!documentId) return;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "company");
    const cookies = await ctx.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    await page.request.delete(`/api/documents/${documentId}`, {
      headers: { cookie: cookieHeader },
    });
    await ctx.close();
  });

  test("GET /api/documents devuelve documento recién subido", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/documents", {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const documents = body.documents ?? body.data ?? body;
    const found = Array.isArray(documents) && documents.some((d: any) => d.id === documentId);
    expect(found).toBe(true);
  });

  test("GET /api/documents/:id devuelve metadata correcta", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get(`/api/documents/${documentId}`, {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const doc = await resp.json();
    expect(doc.id).toBe(documentId);
    expect(doc).toHaveProperty("status");
    expect(doc).toHaveProperty("name");
  });

  test("GET /api/documents/:id/progress devuelve shape válido", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get(`/api/documents/${documentId}/progress`, {
      headers: { cookie: cookieHeader },
    });
    // 200 con JSON o 204 si no hay progreso todavía
    expect([200, 204]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      // status es propiedad del documento o del progress
      const status = body.status ?? body.processingProgress?.step;
      expect(status).toBeDefined();
    }
  });

  test("página de detalle de documento carga sin error", async ({ page }) => {
    await login(page, "company");
    await page.goto(`/dashboard/documents/${documentId}`);
    await expect(page.locator("body")).not.toContainText(/unexpected error|500|not found/i, {
      timeout: 10_000,
    });
  });
});
