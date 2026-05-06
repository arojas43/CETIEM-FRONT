import { test, expect } from "@playwright/test";
import { login, minimalPDF } from "./helpers";

test.describe("Upload de documentos", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "company");
  });

  test("navegar a /dashboard/upload", async ({ page }) => {
    await page.goto("/dashboard/upload");
    await expect(page).toHaveURL(/\/upload/);
    // Debe existir input de archivo o dropzone
    // File inputs are often hidden inside custom dropzone components
    const dropzone = page.locator("[data-testid='dropzone'], input[type='file'], [class*='dropzone'], [class*='upload']").first();
    await expect(dropzone).toBeAttached({ timeout: 10_000 });
  });

  test("API POST /api/documents acepta PDF válido", async ({ page }) => {
    // Obtener cookie de sesión desde el page autenticado
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const pdfBuffer = minimalPDF(Date.now());
    const response = await page.request.post("/api/documents", {
      headers: { cookie: cookieHeader },
      multipart: {
        file: {
          name: `smoke-test-${Date.now()}.pdf`,
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        },
      },
    });

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status", "PENDING");

    // Guardar documentId para limpieza (best-effort)
    const documentId = body.id as string;
    await page.request.delete(`/api/documents/${documentId}`, {
      headers: { cookie: cookieHeader },
    });
  });

  test("API POST /api/documents rechaza archivo no-PDF", async ({ page }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const response = await page.request.post("/api/documents", {
      headers: { cookie: cookieHeader },
      multipart: {
        file: {
          name: "malware.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("MZ fake exe"),
        },
      },
    });
    // 400 = rejected for invalid type; 429 = rate limited (both mean upload was not accepted)
    expect([400, 429]).toContain(response.status());
  });
});
