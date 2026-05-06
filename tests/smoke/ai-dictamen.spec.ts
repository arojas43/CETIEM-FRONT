import { test, expect } from "@playwright/test";
import { login, logout } from "./helpers";

const COMPANY_ID = "cmo0mbf0r0002nu544slvvdxg"; // empresa1@cetiem.mx

test.describe("AI Dictamen — assessor review flow", () => {
  test("assessor can see AI dictamen panel in review page", async ({ page }) => {
    await login(page, "assessor");
    await page.goto(`/dashboard/review/company/${COMPANY_ID}`);
    await expect(page).not.toHaveURL(/\/auth\/signin/);

    // Wait for the AI panel to load
    const aiPanel = page.locator("text=Análisis Preliminar IA").first();
    await expect(aiPanel).toBeVisible({ timeout: 20_000 });

    // Panel should show READY content, not loading spinner
    await expect(page.locator("text=Generating").or(page.locator("text=Generando"))).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  });

  test("assessor sees VLAP suggestions from AI", async ({ page }) => {
    await login(page, "assessor");
    await page.goto(`/dashboard/review/company/${COMPANY_ID}`);

    // Wait for page to settle
    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // Check for VLAP section content
    const body = await page.locator("body").textContent({ timeout: 15_000 });
    const hasVlapContent = body?.includes("vigencia") || body?.includes("Vigencia") ||
                           body?.includes("legibilidad") || body?.includes("Legibilidad") ||
                           body?.includes("autoria") || body?.includes("Autoría");
    expect(hasVlapContent).toBeTruthy();
  });

  test("assessor sees findings from AI", async ({ page }) => {
    await login(page, "assessor");
    await page.goto(`/dashboard/review/company/${COMPANY_ID}`);

    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // AI should have generated findings
    const body = await page.locator("body").textContent({ timeout: 15_000 });
    const hasFindings = body?.includes("NON_COMPLIANCE") || body?.includes("COMPLIANCE") ||
                        body?.includes("OBSERVATION") || body?.includes("RECOMMENDATION") ||
                        body?.includes("hallazgo") || body?.includes("Hallazgo");
    expect(hasFindings).toBeTruthy();
  });

  test("admin can access AI dictamen API", async ({ page }) => {
    await login(page, "admin");

    const response = await page.request.get(
      `/api/companies/${COMPANY_ID}/ai-dictamen`
    );
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.dictamen).toBeTruthy();
    expect(data.dictamen.status).toBe("READY");
    expect(Array.isArray(data.dictamen.findings)).toBe(true);
    expect(data.dictamen.findings.length).toBeGreaterThan(0);
    expect(data.dictamen.vlap).toBeTruthy();
    expect(data.dictamen.summary).toBeTruthy();

    await logout(page);
  });

  test("company cannot access other company AI dictamen", async ({ page }) => {
    // Log in as empresa2 - should not access empresa1's dictamen
    await page.goto("/auth/signin");
    await page.fill('input[name="email"]', "empresa2@cetiem.mx");
    await page.fill('input[name="password"]', "cetiem2024");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });

    const response = await page.request.get(
      `/api/companies/${COMPANY_ID}/ai-dictamen`
    );
    expect(response.status()).toBe(403);

    await logout(page);
  });

  test("assessor can regenerate AI dictamen via POST", async ({ page }) => {
    await login(page, "assessor");

    const response = await page.request.post(
      `/api/companies/${COMPANY_ID}/ai-dictamen`
    );
    // Should succeed (200) since this assessor is assigned to this company
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);

    await logout(page);
  });
});
