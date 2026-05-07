/**
 * Exploración visual completa por los 3 roles: company, assessor, admin.
 * Guarda screenshots en /tmp/cetiem-screens/
 */
import { test, expect } from "@playwright/test";
import { login, minimalPDF } from "./helpers";
import * as fs from "fs";
import * as path from "path";

const SCREENSDIR = "/tmp/cetiem-screens";

function shot(name: string) {
  return path.join(SCREENSDIR, `${name}.png`);
}

test.beforeAll(() => {
  fs.mkdirSync(SCREENSDIR, { recursive: true });
});

test.setTimeout(60_000);

// ─────────────────────────────────────────────────────────
// PÁGINAS PÚBLICAS
// ─────────────────────────────────────────────────────────
test("landing page — CETIEM branding", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("00-landing"), fullPage: true });
  await expect(page.locator("text=CETIEM").first()).toBeVisible();
  const body = await page.content();
  expect(body).not.toContain("gob.mx");
});

test("login page — dark CETIEM theme", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/auth/signin");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("01-login"), fullPage: true });
  await expect(page.locator("h1", { hasText: "Iniciar sesión" })).toBeVisible();
  await expect(page.locator("text=Agile Audit Hub").first()).toBeVisible();
});

test("register page — step 1", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("02-register"), fullPage: true });
});

// ─────────────────────────────────────────────────────────
// ROL: COMPANY
// ─────────────────────────────────────────────────────────
test.describe("ROL empresa", () => {
  test("dashboard", async ({ page }) => {
    await login(page, "company");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("10-empresa-dashboard"), fullPage: true });
  });

  test("documentos ESG", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("11-empresa-documentos"), fullPage: true });
  });

  test("carga masiva — UI", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/upload");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("12-empresa-upload-vacio"), fullPage: true });
  });

  test("subir PDF y ver detalle", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/upload");
    await page.waitForLoadState("networkidle");

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      const pdfBuf = minimalPDF(Date.now() + 99999);
      await fileInput.setInputFiles({
        name: `kunan-prueba-${Date.now()}.pdf`,
        mimeType: "application/pdf",
        buffer: pdfBuf,
      });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot("13-empresa-archivo-seleccionado"), fullPage: false });

      const uploadBtn = page
        .locator("button")
        .filter({ hasText: /subir|upload|enviar|cargar/i })
        .first();
      if ((await uploadBtn.count()) > 0 && (await uploadBtn.isEnabled())) {
        await uploadBtn.click();
        await page.waitForTimeout(4000);
        await page.screenshot({ path: shot("14-empresa-upload-completado"), fullPage: false });
      }
    }

    // Ver listado de documentos
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("15-empresa-docs-tras-subida"), fullPage: true });

    // Abrir primero
    const docLink = page.locator("a[href*='/dashboard/documents/']").first();
    if ((await docLink.count()) > 0) {
      await docLink.click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: shot("16-empresa-doc-detalle"), fullPage: true });

      // Procesar con IA si hay botón
      const processBtn = page
        .locator("button")
        .filter({ hasText: /procesar/i })
        .first();
      if ((await processBtn.count()) > 0 && (await processBtn.isEnabled())) {
        await processBtn.click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: shot("17-empresa-procesando"), fullPage: true });
      }
    }
  });

  test("tickets CAPA", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/capa");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("18-empresa-capa"), fullPage: true });
  });

  test("mi certificado", async ({ page }) => {
    await login(page, "company");
    await page.goto("/dashboard/mi-certificado");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("19-empresa-certificado"), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────
// ROL: ASSESSOR
// ─────────────────────────────────────────────────────────
test.describe("ROL assessor", () => {
  test("dashboard", async ({ page }) => {
    await login(page, "assessor");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("20-assessor-dashboard"), fullPage: true });
  });

  test("cola de revisión", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/queue");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("21-assessor-queue"), fullPage: true });
  });

  test("empresas ESG", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("22-assessor-empresas"), fullPage: true });
  });

  test("documentos", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("23-assessor-documentos"), fullPage: true });
  });

  test("grafo global", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/graph");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shot("24-assessor-grafo"), fullPage: false });
  });

  test("abrir empresa en cola", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/queue");
    await page.waitForLoadState("networkidle");
    const reviewLink = page.locator("a[href*='/dashboard/review/company/']").first();
    if ((await reviewLink.count()) > 0) {
      await reviewLink.click();
      // Esperar cambio de URL — crítico en Next.js client-side navigation
      await page.waitForURL("**/review/company/**", { timeout: 10_000 });
      await page.waitForTimeout(3000); // esperar fetch inicial
      await page.screenshot({ path: shot("25-assessor-review"), fullPage: true });
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.screenshot({ path: shot("25b-assessor-review-scroll"), fullPage: false });
    }
  });

  test("tickets CAPA", async ({ page }) => {
    await login(page, "assessor");
    await page.goto("/dashboard/capa");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("26-assessor-capa"), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────
// ROL: ADMIN
// ─────────────────────────────────────────────────────────
test.describe("ROL admin", () => {
  test("dashboard supervisión", async ({ page }) => {
    await login(page, "admin");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("30-admin-dashboard"), fullPage: true });
  });

  test("empresas registradas", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("31-admin-empresas"), fullPage: true });
  });

  test("assessors ESG", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/assessors");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("32-admin-assessors"), fullPage: true });
  });

  test("fondo documental", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/documents");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("33-admin-documentos"), fullPage: true });
  });

  test("grafo de relaciones", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/graph");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shot("34-admin-grafo"), fullPage: false });
  });

  test("auditoría logs", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/logs");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("35-admin-logs"), fullPage: true });
  });

  test("tickets CAPA admin", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/capa");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot("36-admin-capa"), fullPage: true });
  });

  test("detalle primera empresa", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/dashboard/companies");
    await page.waitForLoadState("networkidle");
    const companyLink = page
      .locator("a[href*='/dashboard/review/company/']")
      .first();
    if ((await companyLink.count()) > 0) {
      await companyLink.click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: shot("37-admin-empresa-detalle"), fullPage: true });
    }
  });
});
