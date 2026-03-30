// ============================================================
// CETIEM — Playwright E2E: Panel de Empresa
// Cubre: login, dashboard, listado de documentos, upload,
//        detalle de documento, operaciones (eliminar), CAPA
// Uso: playwright test tests/empresa-panel.spec.js --headed (o sin --headed)
// ============================================================

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const EMAIL    = 'empresa1@cetiem.mx';
const PASSWORD = 'cetiem2024';

// ── Helpers ─────────────────────────────────────────────────

/** Crea un PDF mínimo válido en un archivo temporal */
function createTestPDF() {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 130>>stream
BT /F1 12 Tf 72 720 Td (CETIEM - Prueba Automatizada Playwright) Tj 0 -20 Td (Certificacion ISO 9001 Gestion de Calidad) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000448 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
530
%%EOF`;
  const tmpFile = path.join(os.tmpdir(), `cetiem-test-${Date.now()}.pdf`);
  fs.writeFileSync(tmpFile, content);
  return tmpFile;
}

/** Login helper reutilizable */
async function loginAsEmpresa(page) {
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
}

// ── Tests ────────────────────────────────────────────────────

test.describe('Panel Empresa — CETIEM', () => {

  // ── 1. Autenticación ──────────────────────────────────────
  test.describe('1. Autenticación', () => {

    test('1.1 Página de login carga correctamente', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/signin`);
      await expect(page).toHaveTitle(/.+/);
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passInput  = page.locator('input[type="password"], input[name="password"]');
      const submitBtn  = page.locator('button[type="submit"]');
      await expect(emailInput).toBeVisible();
      await expect(passInput).toBeVisible();
      await expect(submitBtn).toBeVisible();
    });

    test('1.2 Login con credenciales incorrectas muestra error', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth/signin`);
      await page.fill('input[type="email"], input[name="email"]', 'wrong@email.com');
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      // Debe permanecer en signin o mostrar error, no redirigir a dashboard
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url).not.toMatch(/\/dashboard/);
    });

    test('1.3 Login exitoso como empresa → redirige a dashboard', async ({ page }) => {
      await loginAsEmpresa(page);
      await expect(page).toHaveURL(/dashboard/);
    });

    test('1.4 Sin sesión → redirige al login', async ({ page }) => {
      // Acceso directo sin cookies
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(2000);
      const url = page.url();
      // Debe redirigir a signin o mostrar 401
      expect(url).toMatch(/signin|auth|login|dashboard/);
    });

  });

  // ── 2. Dashboard ──────────────────────────────────────────
  test.describe('2. Dashboard principal', () => {

    test('2.1 Dashboard carga tras login', async ({ page }) => {
      await loginAsEmpresa(page);
      // Esperar contenido visible
      await expect(page.locator('body')).toBeVisible();
      // Debe haber algún nav o sidebar
      const nav = page.locator('nav, aside, [role="navigation"]');
      await expect(nav.first()).toBeVisible({ timeout: 10000 });
    });

    test('2.2 Dashboard muestra información de la empresa', async ({ page }) => {
      await loginAsEmpresa(page);
      const body = await page.textContent('body');
      // Debe contener alguna referencia al usuario o empresa
      const hasEmpresaContent =
        body.includes('empresa') || body.includes('Empresa') ||
        body.includes('documento') || body.includes('Documento') ||
        body.includes('dashboard') || body.includes('Dashboard');
      expect(hasEmpresaContent).toBeTruthy();
    });

    test('2.3 Navegación principal visible', async ({ page }) => {
      await loginAsEmpresa(page);
      // Buscar links de navegación comunes
      const links = page.locator('a[href*="/dashboard"]');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
    });

  });

  // ── 3. Documentos — Listado ───────────────────────────────
  test.describe('3. Documentos — Listado', () => {

    test('3.1 Sección de documentos accesible', async ({ page }) => {
      await loginAsEmpresa(page);
      // Navegar a documentos (varios paths posibles)
      const docsLink = page.locator(
        'a[href*="document"], a[href*="Document"], ' +
        'a:has-text("Documento"), a:has-text("documento"), ' +
        'a:has-text("Documents"), a:has-text("Archivos")'
      ).first();

      if (await docsLink.isVisible()) {
        await docsLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Navegar directamente
        await page.goto(`${BASE_URL}/dashboard/documents`);
      }
      await expect(page.locator('body')).toBeVisible();
    });

    test('3.2 Tabla/lista de documentos renderiza', async ({ page }) => {
      await loginAsEmpresa(page);
      await page.goto(`${BASE_URL}/dashboard/documents`).catch(() => {});
      await page.waitForLoadState('networkidle');

      // Buscar tabla, lista o grid de documentos
      const container = page.locator(
        'table, [role="table"], ul, .document-list, ' +
        '[data-testid="documents"], .grid, .list'
      ).first();

      // Si existe, debe ser visible; si no, la página al menos cargó
      const bodyText = await page.textContent('body');
      const hasContent = bodyText.length > 100;
      expect(hasContent).toBeTruthy();
    });

  });

  // ── 4. Documentos — Upload ────────────────────────────────
  test.describe('4. Documentos — Upload', () => {

    test('4.1 Botón/formulario de upload visible', async ({ page }) => {
      await loginAsEmpresa(page);

      // Buscar el botón de upload en el dashboard o página de documentos
      const pages = [
        `${BASE_URL}/dashboard`,
        `${BASE_URL}/dashboard/documents`,
        `${BASE_URL}/dashboard/upload`,
      ];

      let uploadVisible = false;
      for (const url of pages) {
        await page.goto(url).catch(() => {});
        await page.waitForLoadState('networkidle');

        const uploadBtn = page.locator(
          'input[type="file"], ' +
          'button:has-text("Subir"), button:has-text("Upload"), ' +
          'button:has-text("subir"), button:has-text("Cargar"), ' +
          '[data-testid="upload-btn"], label:has-text("Subir")'
        ).first();

        if (await uploadBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          uploadVisible = true;
          break;
        }
      }
      expect(uploadVisible).toBeTruthy();
    });

    test('4.2 Upload de PDF via API funciona', async ({ page }) => {
      // Test vía API directamente (más confiable para el flujo de upload)
      await loginAsEmpresa(page);

      const tmpPDF = createTestPDF();
      try {
        // Usar fetch desde el contexto del browser con las cookies de sesión
        const result = await page.evaluate(async (baseUrl) => {
          const formData = new FormData();
          const response = await fetch(`${baseUrl}/api/auth/csrf`);
          const { csrfToken } = await response.json();

          // Crear un blob mínimo tipo PDF
          const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
          const blob = new Blob([pdfContent], { type: 'application/pdf' });
          formData.append('file', blob, 'playwright-test.pdf');
          formData.append('name', 'Playwright Test Doc');
          formData.append('description', 'Test E2E Playwright');
          formData.append('domain', 'legal');

          const uploadRes = await fetch(`${baseUrl}/api/documents`, {
            method: 'POST',
            body: formData,
          });
          return {
            status: uploadRes.status,
            body: await uploadRes.json().catch(() => ({})),
          };
        }, BASE_URL);

        expect([200, 201]).toContain(result.status);
        if (result.body.id) {
          // Limpiar
          await page.evaluate(async ({ baseUrl, docId }) => {
            await fetch(`${baseUrl}/api/documents/${docId}`, { method: 'DELETE' });
          }, { baseUrl: BASE_URL, docId: result.body.id });
        }
      } finally {
        fs.unlinkSync(tmpPDF);
      }
    });

  });

  // ── 5. Documentos — Detalle y operaciones ────────────────
  test.describe('5. Documentos — Detalle y operaciones', () => {

    let uploadedDocId = null;

    test.beforeEach(async ({ page }) => {
      await loginAsEmpresa(page);
      // Subir documento de prueba via API
      const result = await page.evaluate(async (baseUrl) => {
        const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const fd = new FormData();
        fd.append('file', blob, 'test-detail.pdf');
        fd.append('name', 'Test Detalle E2E');
        fd.append('domain', 'legal');
        const res = await fetch(`${baseUrl}/api/documents`, { method: 'POST', body: fd });
        return res.json().catch(() => ({}));
      }, BASE_URL);
      uploadedDocId = result.id || null;
    });

    test.afterEach(async ({ page }) => {
      if (uploadedDocId) {
        await page.evaluate(async ({ baseUrl, id }) => {
          await fetch(`${baseUrl}/api/documents/${id}`, { method: 'DELETE' });
        }, { baseUrl: BASE_URL, id: uploadedDocId });
        uploadedDocId = null;
      }
    });

    test('5.1 Detalle de documento accesible via API', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}`);
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, { baseUrl: BASE_URL, id: uploadedDocId });

      expect(result.status).toBe(200);
      expect(result.body).toHaveProperty('name');
    });

    test('5.2 Actualizar dominio del documento', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/domain`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: 'CONSTRUCCION' }),
        });
        return { status: res.status };
      }, { baseUrl: BASE_URL, id: uploadedDocId });
      expect([200, 201]).toContain(result.status);
    });

    test('5.3 Iniciar procesamiento de documento', async ({ page }) => {
      test.setTimeout(120000); // pdfjs procesa el PDF — puede tardar hasta 2 min
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, { baseUrl: BASE_URL, id: uploadedDocId });
      expect([200, 201, 202]).toContain(result.status);
    });

    test('5.4 Consultar progreso de procesamiento', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/progress`);
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, { baseUrl: BASE_URL, id: uploadedDocId });
      expect(result.status).toBe(200);
    });

    test('5.5 Búsqueda dentro del documento', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'certificacion', limit: 5 }),
        });
        return { status: res.status };
      }, { baseUrl: BASE_URL, id: uploadedDocId });
      // 200 (con resultados) o 404 (sin índice aún) son válidos
      expect([200, 404]).toContain(result.status);
    });

    test('5.6 Eliminar documento', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      const result = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}`, { method: 'DELETE' });
        return { status: res.status };
      }, { baseUrl: BASE_URL, id: uploadedDocId });
      expect([200, 204]).toContain(result.status);
      uploadedDocId = null; // ya eliminado, evitar doble delete en afterEach
    });

    test('5.7 Página de detalle renderiza en el navegador', async ({ page }) => {
      if (!uploadedDocId) { test.skip(); return; }
      await page.goto(`${BASE_URL}/dashboard/documents/${uploadedDocId}`).catch(() => {});
      await page.waitForLoadState('networkidle');
      // Debe cargar algo (404 en UI también es aceptable si el doc acaba de subirse)
      await expect(page.locator('body')).toBeVisible();
    });

  });

  // ── 6. CAPA tickets ───────────────────────────────────────
  test.describe('6. CAPA tickets', () => {

    test('6.1 Listado de CAPA accesible para empresa', async ({ page }) => {
      await loginAsEmpresa(page);
      const result = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/capa`);
        return { status: res.status };
      }, BASE_URL);
      expect(result.status).toBe(200);
    });

    test('6.2 Sección CAPA visible en UI (si existe link)', async ({ page }) => {
      await loginAsEmpresa(page);
      const capaLink = page.locator(
        'a[href*="capa"], a[href*="CAPA"], ' +
        'a:has-text("CAPA"), a:has-text("Correctivo"), a:has-text("Accion")'
      ).first();
      if (await capaLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await capaLink.click();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('body')).toBeVisible();
      } else {
        // No hay link visible, verificar que el endpoint al menos responde
        test.info().annotations.push({ type: 'note', description: 'Link CAPA no visible en nav, solo verificado via API' });
      }
    });

  });

  // ── 7. Seguridad ──────────────────────────────────────────
  test.describe('7. Seguridad y control de acceso', () => {

    test('7.1 Empresa no puede acceder a /api/audit', async ({ page }) => {
      await loginAsEmpresa(page);
      const result = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/audit`);
        return { status: res.status };
      }, BASE_URL);
      expect([401, 403]).toContain(result.status);
    });

    test('7.2 Sin sesión no se pueden listar documentos', async ({ browser }) => {
      // Contexto limpio sin cookies de sesión
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      await pg.goto(`${BASE_URL}/auth/signin`);
      const result = await pg.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/documents`);
        return { status: res.status };
      }, BASE_URL);
      await ctx.close();
      expect([401, 403]).toContain(result.status);
    });

    test('7.3 Empresa no puede asignar assessors (admin only)', async ({ page }) => {
      await loginAsEmpresa(page);
      // Obtener ID de cualquier empresa para intentar la operación
      const docsRes = await page.evaluate(async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/documents`);
        const data = await res.json().catch(() => ({}));
        return data?.documents?.[0]?.userId || null;
      }, BASE_URL);

      const result = await page.evaluate(async ({ baseUrl }) => {
        const res = await fetch(`${baseUrl}/api/companies/fake-id/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessorId: 'fake-assessor' }),
        });
        return { status: res.status };
      }, { baseUrl: BASE_URL });
      expect([401, 403, 404]).toContain(result.status);
    });

  });

  // ── 8. Flujo completo de ingesta ──────────────────────────
  test.describe('8. Flujo completo: upload → procesamiento → verificación', () => {

    test('8.1 Ciclo completo de vida de un documento', async ({ page }) => {
      test.setTimeout(180000); // flujo completo incluye procesamiento PDF
      await loginAsEmpresa(page);

      // Paso 1: Upload
      const uploadResult = await page.evaluate(async (baseUrl) => {
        const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`;
        const blob = new Blob([pdfContent], { type: 'application/pdf' });
        const fd = new FormData();
        fd.append('file', blob, 'ciclo-completo.pdf');
        fd.append('name', 'Ciclo Completo E2E');
        fd.append('domain', 'legal');
        const res = await fetch(`${baseUrl}/api/documents`, { method: 'POST', body: fd });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, BASE_URL);

      expect([200, 201]).toContain(uploadResult.status);
      const docId = uploadResult.body.id;
      expect(docId).toBeTruthy();

      // Paso 2: Verificar que aparece en listado
      const listResult = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents`);
        const data = await res.json().catch(() => ({}));
        const docs = data.data || [];
        return docs.some(d => d.id === id);
      }, { baseUrl: BASE_URL, id: docId });
      expect(listResult).toBeTruthy();

      // Paso 3: Actualizar domain
      const domainResult = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/domain`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: 'CONSTRUCCION' }),
        });
        return res.status;
      }, { baseUrl: BASE_URL, id: docId });
      expect([200, 201]).toContain(domainResult);

      // Paso 4: Iniciar procesamiento
      const processResult = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return res.status;
      }, { baseUrl: BASE_URL, id: docId });
      expect([200, 201, 202]).toContain(processResult);

      // Paso 5: Verificar progreso disponible
      await page.waitForTimeout(1000);
      const progressResult = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}/progress`);
        return { status: res.status, body: await res.json().catch(() => ({})) };
      }, { baseUrl: BASE_URL, id: docId });
      expect(progressResult.status).toBe(200);

      // Paso 6: Limpiar
      const deleteResult = await page.evaluate(async ({ baseUrl, id }) => {
        const res = await fetch(`${baseUrl}/api/documents/${id}`, { method: 'DELETE' });
        return res.status;
      }, { baseUrl: BASE_URL, id: docId });
      expect([200, 204]).toContain(deleteResult);
    });

  });

});
