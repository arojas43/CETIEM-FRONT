import { test } from "@playwright/test";
import { login } from "./helpers";

test.setTimeout(120_000);

const COMPANY_ID = 'cmo0mbf0r0002nu544slvvdxg';

test("forzar generación dictamen IA y mostrar resultado", async ({ page }) => {
  await login(page, "assessor");

  // Forzar regeneración
  const postRes = await page.request.post(`/api/companies/${COMPANY_ID}/ai-dictamen`);
  console.log(`POST dictamen → HTTP ${postRes.status()}`);

  // Polling hasta 90s
  for (let i = 1; i <= 9; i++) {
    await page.waitForTimeout(10_000);
    const getRes = await page.request.get(`/api/companies/${COMPANY_ID}/ai-dictamen`);
    if (!getRes.ok()) { console.log(`GET ${getRes.status()}`); continue; }
    const { dictamen } = await getRes.json().catch(() => ({}));
    console.log(`[t+${i*10}s] status=${dictamen?.status}`);
    if (dictamen?.status === 'READY') {
      console.log(`\n=== DICTAMEN IA ===`);
      console.log(`Modelo: ${dictamen.modelUsed}`);
      console.log(`VLAP vigencia:    ${dictamen.vlap?.vigencia?.suggestion} (${dictamen.vlap?.vigencia?.confidence}%)`);
      console.log(`VLAP legibilidad: ${dictamen.vlap?.legibilidad?.suggestion} (${dictamen.vlap?.legibilidad?.confidence}%)`);
      console.log(`VLAP autoría:     ${dictamen.vlap?.autoria?.suggestion} (${dictamen.vlap?.autoria?.confidence}%)`);
      console.log(`VLAP pertinencia: ${dictamen.vlap?.pertinencia?.suggestion} (${dictamen.vlap?.pertinencia?.confidence}%)`);
      console.log(`\nResumen: ${dictamen.summary}`);
      if (Array.isArray(dictamen.findings)) {
        console.log(`\nHallazgos (${dictamen.findings.length}):`);
        for (const f of dictamen.findings)
          console.log(`  [${f.severity}] ${f.type}: ${f.title}`);
      }
      if (dictamen.errorMsg) console.log(`Error: ${dictamen.errorMsg}`);
      break;
    }
  }
});
