/**
 * Smoke: flujo de certificación ESG.
 * Verifica que los endpoints de certificación responden correctamente.
 * No completa el flujo completo (requiere documentos analizados + assessor).
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Certificación ESG", () => {
  test("GET /api/companies lista empresas (assessor)", async ({ page }) => {
    await login(page, "assessor");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/companies", {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const companies = body.companies ?? body.data ?? body;
    expect(Array.isArray(companies)).toBe(true);
  });

  test("GET /api/capa lista tickets CAPA (company)", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/capa", {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const tickets = body.tickets ?? body.data ?? (Array.isArray(body) ? body : null) ?? [];
    expect(Array.isArray(tickets)).toBe(true);
  });

  test("GET /api/notifications devuelve notificaciones", async ({ page }) => {
    await login(page, "company");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await page.request.get("/api/notifications", {
      headers: { cookie: cookieHeader },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const notifications = body.notifications ?? body;
    expect(Array.isArray(notifications)).toBe(true);
  });

  test("página /dashboard/capa carga sin errores", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/capa");
    await expect(page.locator("body")).not.toContainText(/unexpected error|500/i, {
      timeout: 10_000,
    });
  });

  test("página /dashboard/companies carga para assessor", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/companies");
    await expect(page.locator("body")).not.toContainText(/unexpected error|500/i, {
      timeout: 10_000,
    });
  });
});
