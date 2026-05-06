import { test, expect } from "@playwright/test";
import { login, logout, USERS } from "./helpers";

test.describe("Auth", () => {
  test("redirect to signin when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("company login → dashboard", async ({ page }) => {
    await login(page, "company");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("body")).not.toContainText("Error");
  });

  test("invalid credentials show error", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.fill('input[name="email"]', USERS.company.email);
    await page.fill('input[name="password"]', "wrong-password-xyz");
    await page.click('button[type="submit"]');
    await expect(page.locator("body")).toContainText(/credenciales|invalid|error/i, {
      timeout: 10_000,
    });
  });

  test("authenticated user redirected away from /auth/signin", async ({ page }) => {
    await login(page, "company");
    await page.goto("/auth/signin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("assessor login → dashboard", async ({ page }) => {
    await login(page, "assessor");
    await expect(page).toHaveURL(/\/dashboard/);
    await logout(page);
  });
});
