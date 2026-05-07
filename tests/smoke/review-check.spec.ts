import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("queue → click → review page carga correctamente", async ({ page }) => {
  await login(page, "assessor");
  await page.goto("/dashboard/queue");
  await page.waitForLoadState("networkidle");

  const reviewLink = page.locator("a[href*='/dashboard/review/company/']").first();
  const count = await reviewLink.count();
  console.log("Links encontrados:", count);

  if (count > 0) {
    const href = await reviewLink.getAttribute("href");
    console.log("href:", href);
    await reviewLink.click();
    await page.waitForURL("**/review/company/**", { timeout: 10_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "/tmp/cetiem-screens/review-after-click.png", fullPage: true });
    console.log("URL final:", page.url());
    await expect(page).toHaveURL(/\/dashboard\/review\/company\//);
  }
});

test("regenerar AI dictamen y ver resultado", async ({ page }) => {
  await login(page, "assessor");
  await page.goto("/dashboard/review/company/cmo0mbf0r0002nu544slvvdxg");
  await page.waitForTimeout(2000);

  // Clic en Reintentar si hay error
  const retryBtn = page.locator("button", { hasText: /reintentar|regenerar/i }).first();
  if (await retryBtn.count() > 0) {
    console.log("Encontrado botón Reintentar — clickando...");
    await retryBtn.click();
    // Esperar resultado (máx 2min para kimi-k2)
    await page.waitForTimeout(15000);
    await page.screenshot({ path: "/tmp/cetiem-screens/review-ai-regenerated.png", fullPage: true });
  }

  await page.screenshot({ path: "/tmp/cetiem-screens/review-final.png", fullPage: true });
  const content = await page.content();
  const hasError = content.includes("Error al generar");
  console.log("Tiene error de IA:", hasError);
});
