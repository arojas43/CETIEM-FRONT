import type { Page } from "@playwright/test";

export const USERS = {
  company: { email: "empresa1@cetiem.mx", password: "cetiem2024" },
  assessor: { email: "assessor@cetiem.mx", password: "cetiem2024" },
  admin:    { email: "admin@cetiem.mx",    password: "cetiem2024" },
};

/** Minimal valid single-page PDF with unique content to avoid SHA-256 dedup */
export function minimalPDF(seed = Date.now()): Buffer {
  const body =
    `BT /F1 12 Tf 72 720 Td (CETIEM - Smoke Test ESG - ${seed}) Tj ET`;
  const stream = `<</Length ${body.length}>>stream\n${body}\nendstream`;
  const src = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    `3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj${stream}endobj`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "0000000115 00000 n ",
    "0000000300 00000 n ",
    "0000000450 00000 n ",
    `trailer<</Size 6/Root 1 0 R>>`,
    "startxref",
    "530",
    "%%EOF",
  ].join("\n");
  return Buffer.from(src, "utf-8");
}

export async function login(page: Page, role: keyof typeof USERS) {
  const { email, password } = USERS[role];
  // Clear any existing session before logging in to avoid stale-session redirect
  await page.context().clearCookies();
  await page.goto("/auth/signin");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
