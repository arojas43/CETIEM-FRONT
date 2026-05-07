/**
 * Sube los 4 PDFs reales de Grupo Kunan/Gradisa vía API directa,
 * espera el procesamiento y verifica el dictamen IA.
 *
 * PDFs: Constancia CSF, Acta Constitutiva, Estado de cuenta, Opinión 32-D
 */
import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import * as fs from "fs";
import * as path from "path";

const SCREENSDIR = "/tmp/cetiem-screens/real-pdfs";
const PDF_DIR    = "/home/alex/cetiem";

const DOCS = [
  {
    file: "Constancia Grupo Kunan.pdf",
    tipo: "CONSTANCIA_FISCAL",
    categoria: "GOBERNANZA",
    desc: "Constancia de Situación Fiscal — GRUPO KUNAN (RFC: GGR240723PD6)",
  },
  {
    file: "Constitutiva original.pdf",
    tipo: "ACTA_CONSTITUTIVA",
    categoria: "GOBERNANZA",
    desc: "Acta Constitutiva — GRUPO GRADISA S.A. de C.V. — Notaría 49 Querétaro jul 2024",
  },
  {
    file: "Estado de cuenta 2026-03-01.pdf",
    tipo: "COMPROBANTE_DOMICILIO",
    categoria: "GOBERNANZA",
    desc: "Estado de cuenta Fondeadora — mar 2026 — GRUPO KUNAN SA DE CV",
  },
  {
    file: "OpinionCumplimientoSAT_Abr26_CVI.pdf",
    tipo: "OPINION_CUMPLIMIENTO_SAT",
    categoria: "FINANCIERO",
    desc: "Opinión 32-D SAT POSITIVO — César Villaseñor Islas (rep. legal) — abr 2026",
  },
];

function shot(name: string) {
  return path.join(SCREENSDIR, `${name}.png`);
}

test.beforeAll(() => {
  fs.mkdirSync(SCREENSDIR, { recursive: true });
});

test.setTimeout(180_000);

// ─── 1. Subir los 4 PDFs vía API ─────────────────────────────────────────────

test("subir 4 PDFs reales de Grupo Kunan vía API", async ({ page }) => {
  // Hacer login y obtener cookie de sesión
  await login(page, "company");

  let uploaded = 0;

  for (const doc of DOCS) {
    const filePath = path.join(PDF_DIR, doc.file);
    expect(fs.existsSync(filePath)).toBe(true);

    const fileBuffer = fs.readFileSync(filePath);

    const res = await page.request.post("/api/documents", {
      multipart: {
        file: {
          name: doc.file,
          mimeType: "application/pdf",
          buffer: fileBuffer,
        },
        description:  doc.desc,
        tipoDocumento: doc.tipo,
        categoriaDoc:  doc.categoria,
      },
    });

    const status = res.status();
    const body   = await res.json().catch(() => ({}));
    console.log(`[Upload] ${doc.file} → HTTP ${status}`, body?.id ? `id=${body.id}` : body?.error || "");

    if (status >= 200 && status < 300) uploaded++;
    else console.warn(`[Upload] FALLO: ${doc.file} → ${status} ${JSON.stringify(body)}`);
  }

  console.log(`Documentos subidos: ${uploaded}/${DOCS.length}`);

  // Verificar en la UI
  await page.goto("/dashboard/documents");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("01-documentos-tras-subida"), fullPage: true });

  expect(uploaded).toBeGreaterThan(0);
});

// ─── 2. Ver el estado de procesamiento ───────────────────────────────────────

test("esperar procesamiento y capturar estados", async ({ page }) => {
  await login(page, "company");
  await page.goto("/dashboard/documents");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("10-estado-t0"), fullPage: true });

  // Poll cada 15s hasta 2 minutos
  let finalStatus = "";
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(15_000);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot(`11-poll-${i}`), fullPage: true });

    const pageText = await page.content();
    const hasAnalyzed = pageText.includes("ANALYZED") || pageText.includes("Analizado");
    const hasIndexed  = pageText.includes("INDEXED")  || pageText.includes("Indexado");
    const hasFailed   = pageText.includes("FAILED")   || pageText.includes("Error");
    const hasProcessing = pageText.includes("PROCESSING") || pageText.includes("Procesando");

    finalStatus = hasAnalyzed ? "ANALYZED" : hasIndexed ? "INDEXED" : hasProcessing ? "PROCESSING" : hasFailed ? "FAILED" : "PENDING";
    console.log(`[t+${i * 15}s] Estado: ${finalStatus}`);

    if (hasAnalyzed || hasIndexed) break;
  }

  console.log(`Estado final: ${finalStatus}`);
  await page.screenshot({ path: shot("12-estado-final"), fullPage: true });
});

// ─── 3. Detalle de cada documento ────────────────────────────────────────────

test("ver detalle de cada documento y su análisis IA", async ({ page }) => {
  await login(page, "company");
  await page.goto("/dashboard/documents");
  await page.waitForLoadState("networkidle");

  const links = page.locator("a[href*='/dashboard/documents/']");
  const count = await links.count();
  console.log(`Documentos en lista: ${count}`);

  for (let i = 0; i < Math.min(count, 4); i++) {
    const link = links.nth(i);
    const href = await link.getAttribute("href") || "";
    const docId = href.split("/").pop();

    await link.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: shot(`20-doc-${i + 1}-detalle`), fullPage: true });

    // Procesar si hay botón disponible
    const processBtn = page.locator("button").filter({ hasText: /procesar/i }).first();
    if ((await processBtn.count()) > 0 && (await processBtn.isEnabled())) {
      console.log(`[Doc ${i + 1}] Clic en Procesar`);
      await processBtn.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: shot(`21-doc-${i + 1}-procesando`), fullPage: false });
    }

    console.log(`[Doc ${i + 1}] id=${docId}`);
    await page.goBack();
    await page.waitForLoadState("networkidle");
  }
});

// ─── 4. Assessor — cola y revisión ───────────────────────────────────────────

test("assessor abre la revisión de la empresa", async ({ page }) => {
  await login(page, "assessor");
  await page.goto("/dashboard/queue");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: shot("30-assessor-queue"), fullPage: true });

  const reviewLink = page.locator("a[href*='/dashboard/review/company/']").first();
  if (await reviewLink.count() === 0) {
    console.log("Cola vacía — empresa sin documentos procesados aún");
    return;
  }

  await reviewLink.click();
  await page.waitForURL("**/review/company/**", { timeout: 10_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot("31-assessor-review"), fullPage: true });

  // Scroll para ver hallazgos y VLAP
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.screenshot({ path: shot("32-assessor-vlap-hallazgos"), fullPage: false });

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.screenshot({ path: shot("33-assessor-dictamen-ia"), fullPage: false });
});

// ─── 5. Dictamen IA — verificar confiabilidad ─────────────────────────────────

test("verificar dictamen IA y confiabilidad del análisis", async ({ page }) => {
  await login(page, "assessor");
  await page.goto("/dashboard/queue");
  await page.waitForLoadState("networkidle");

  const reviewLink = page.locator("a[href*='/dashboard/review/company/']").first();
  if (await reviewLink.count() === 0) return;

  await reviewLink.click();
  await page.waitForURL("**/review/company/**", { timeout: 10_000 });
  await page.waitForTimeout(5000); // dar tiempo al dictamen IA

  const url = page.url();
  const companyId = url.split("/").pop();
  console.log(`CompanyId: ${companyId}`);

  // Consultar dictamen directamente vía API
  if (companyId) {
    const dictamenRes = await page.request.get(`/api/companies/${companyId}/ai-dictamen`);
    if (dictamenRes.ok()) {
      const { dictamen } = await dictamenRes.json();
      if (dictamen) {
        console.log(`\n=== DICTAMEN IA ===`);
        console.log(`Status: ${dictamen.status}`);
        console.log(`Modelo: ${dictamen.modelUsed}`);
        console.log(`Hallazgos: ${Array.isArray(dictamen.findings) ? dictamen.findings.length : 0}`);
        if (dictamen.vlap) {
          const v = dictamen.vlap;
          console.log(`VLAP vigencia:    ${v.vigencia?.suggestion} (${v.vigencia?.confidence}%)`);
          console.log(`VLAP legibilidad: ${v.legibilidad?.suggestion} (${v.legibilidad?.confidence}%)`);
          console.log(`VLAP autoría:     ${v.autoria?.suggestion} (${v.autoria?.confidence}%)`);
          console.log(`VLAP pertinencia: ${v.pertinencia?.suggestion} (${v.pertinencia?.confidence}%)`);
        }
        if (dictamen.summary) {
          console.log(`\nResumen: ${dictamen.summary}`);
        }
        if (Array.isArray(dictamen.findings)) {
          console.log(`\nHallazgos:`);
          for (const f of dictamen.findings) {
            console.log(`  [${f.severity}] ${f.type}: ${f.title}`);
          }
        }
        if (dictamen.errorMsg) {
          console.log(`\nError: ${dictamen.errorMsg}`);
        }
      } else {
        console.log("Sin dictamen generado aún");
      }
    }
  }

  await page.screenshot({ path: shot("40-dictamen-completo"), fullPage: true });
});
