import { test } from "@playwright/test";
import { login } from "./helpers";

const DOC_IDS = [
  'cmoufo3p10001lf0w21x6hw55',
  'cmoufo3r90005lf0wbrwwifbw',
  'cmoufo3sb0009lf0wrmnzon3s',
  'cmoufo3tc000dlf0wu746hisv',
];

test.setTimeout(300_000);

test("re-process 4 docs via /process endpoint", async ({ page }) => {
  await login(page, "company");

  for (const id of DOC_IDS) {
    const res = await page.request.post(`/api/documents/${id}/process`, {
      data: { domain: "INDUSTRIA" },
    });
    const status = res.status();
    const body = await res.json().catch(() => ({}));
    console.log(`[Process] ${id} → HTTP ${status}`, JSON.stringify(body).slice(0, 150));
  }

  // Poll every 20s for up to 5 minutes
  for (let i = 1; i <= 15; i++) {
    await page.waitForTimeout(20_000);
    const statuses: string[] = [];
    for (const id of DOC_IDS) {
      const res = await page.request.get(`/api/documents/${id}`);
      if (res.ok()) {
        const { document: doc } = await res.json().catch(() => ({ document: {} }));
        statuses.push(`${id.slice(-6)}: ${doc?.status || '?'}`);
      }
    }
    console.log(`[t+${i * 20}s] ${statuses.join(' | ')}`);
    if (statuses.every(s => s.includes('ANALYZED') || s.includes('INDEXED') || s.includes('FAILED'))) break;
  }
});
