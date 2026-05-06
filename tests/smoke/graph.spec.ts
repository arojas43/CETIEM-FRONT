/**
 * Smoke: grafo de conocimiento y estadísticas.
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Grafo de conocimiento", () => {
  test("GET /api/graph/stats devuelve estructura válida", async ({ page }) => {
    await login(page, "admin");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/graph/stats", {
      headers: { cookie: cookieHeader },
    });
    expect([200, 503, 403]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty("connected");
    }
  });

  test("GET /api/graph/company devuelve grafo consolidado de la empresa", async ({ page }) => {
    await login(page, "assessor");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    // Obtener lista de empresas asignadas
    const companiesResp = await page.request.get("/api/companies", {
      headers: { cookie: cookieHeader },
    });
    expect(companiesResp.status()).toBe(200);
    const companiesBody = await companiesResp.json();
    const companies = companiesBody.companies ?? companiesBody.data ?? companiesBody;

    if (!Array.isArray(companies) || companies.length === 0) {
      test.skip(true, "No hay empresas asignadas al assessor de prueba");
      return;
    }

    const companyId = companies[0].id;
    const graphResp = await page.request.get(`/api/graph/company?companyId=${companyId}`, {
      headers: { cookie: cookieHeader },
    });
    expect([200, 503]).toContain(graphResp.status());
    if (graphResp.status() === 200) {
      const body = await graphResp.json();
      expect(body).toHaveProperty("entities");
      expect(Array.isArray(body.entities)).toBe(true);
    }
  });
});
