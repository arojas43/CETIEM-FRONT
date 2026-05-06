/**
 * Genera un dictamen preliminar de IA para una empresa a partir de sus documentos ANALYZED.
 * El assessor lo usa como punto de partida — puede aceptar, editar o descartar cada hallazgo.
 *
 * Modelo: Kimi K2.6 (1M ctx) vía NVIDIA_DEEPSEEK_MODEL env var.
 * Se guarda en tabla AiDictamen con status GENERATING → READY | FAILED.
 */
import { prisma } from "./db";
import { nimService } from "./nim";

export type AiVlapItem = {
  suggestion: boolean | null;
  confidence: number;
  rationale: string;
};

export type AiVlap = {
  vigencia: AiVlapItem;
  legibilidad: AiVlapItem;
  autoria: AiVlapItem;
  pertinencia: AiVlapItem;
};

export type AiDictamenFinding = {
  type: "COMPLIANCE" | "NON_COMPLIANCE" | "OBSERVATION" | "RECOMMENDATION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  recommendation: string;
  documentId?: string;
  documentName?: string;
  page?: number | null;
};

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(
  companyName: string,
  domain: string,
  docs: Array<{ id: string; name: string; categoriaDoc: string; tipoDocumento: string | null; pageIndexSample: string }>
): string {
  const docSummaries = docs.map((d, i) =>
    `### Documento ${i + 1}: "${d.name}" (tipo: ${d.tipoDocumento || d.categoriaDoc})
ID: ${d.id}
Extracto de contenido:
${d.pageIndexSample.slice(0, 3000)}`
  ).join("\n\n");

  return `Eres un experto certificador ESG del programa CETIEM de la Secretaría de Economía de México.
Tu tarea es analizar los documentos de la empresa "${companyName}" (sector: ${domain}) y generar un DICTAMEN PRELIMINAR de certificación ESG.

DOCUMENTOS ANALIZADOS:
${docSummaries}

INSTRUCCIONES:
1. Evalúa los 4 criterios V.L.A.P. para el conjunto de documentos:
   - vigencia: ¿Los documentos están vigentes/actualizados? ¿Tienen fechas recientes?
   - legibilidad: ¿Son legibles, bien estructurados, sin páginas ilegibles?
   - autoria: ¿Tienen firmas, sellos, datos de autoría/responsable claros?
   - pertinencia: ¿Son relevantes para la certificación ESG del sector ${domain}?

2. Identifica hallazgos de:
   - COMPLIANCE: aspectos que cumplen correctamente los estándares ESG
   - NON_COMPLIANCE: incumplimientos que DEBEN corregirse para certificar
   - OBSERVATION: aspectos a mejorar pero no bloqueantes
   - RECOMMENDATION: buenas prácticas adicionales sugeridas

3. Genera un resumen ejecutivo de 2-3 oraciones.

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional):
{
  "vlap": {
    "vigencia": { "suggestion": true/false/null, "confidence": 0-100, "rationale": "explicación breve en español" },
    "legibilidad": { "suggestion": true/false/null, "confidence": 0-100, "rationale": "..." },
    "autoria": { "suggestion": true/false/null, "confidence": 0-100, "rationale": "..." },
    "pertinencia": { "suggestion": true/false/null, "confidence": 0-100, "rationale": "..." }
  },
  "findings": [
    {
      "type": "COMPLIANCE|NON_COMPLIANCE|OBSERVATION|RECOMMENDATION",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "title": "Título corto del hallazgo",
      "description": "Descripción detallada del hallazgo con referencia al documento",
      "recommendation": "Acción concreta que debe tomar la empresa",
      "documentId": "id-del-documento-o-null",
      "documentName": "nombre del documento o null",
      "page": null
    }
  ],
  "summary": "Resumen ejecutivo del dictamen en 2-3 oraciones."
}`;
}

// ── Generación ─────────────────────────────────────────────────────────────────

export async function generateAiDictamen(companyId: string): Promise<string> {
  // Upsert: si ya existe uno READY reciente (<1h), no regenerar
  const existing = await prisma.aiDictamen.findFirst({
    where: { companyId, status: "READY" },
    orderBy: { generatedAt: "desc" },
  });
  if (existing) {
    const ageMs = Date.now() - existing.generatedAt.getTime();
    if (ageMs < 60 * 60 * 1000) {
      console.log(`[AiDictamen] Ya existe uno reciente para ${companyId}, omitiendo`);
      return existing.id;
    }
  }

  // Fetch company + docs ANALYZED con pageIndices
  const company = await prisma.user.findUnique({
    where: { id: companyId },
    select: { companyName: true, industry: true },
  });
  if (!company) throw new Error(`Company ${companyId} no encontrada`);

  const docs = await prisma.document.findMany({
    where: { userId: companyId, status: { in: ["ANALYZED", "INDEXED"] } },
    include: {
      pageIndices: {
        where: { level: 0 },
        take: 1,
        select: { content: true, title: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (docs.length === 0) {
    throw new Error(`No hay documentos ANALYZED para ${companyId}`);
  }

  const docIds = docs.map(d => d.id);

  // Crear registro GENERATING
  const dictamen = await prisma.aiDictamen.create({
    data: {
      companyId,
      status: "GENERATING",
      findings: [],
      docIds,
      modelUsed: process.env.NVIDIA_DEEPSEEK_MODEL || "moonshotai/kimi-k2.6",
    },
  });

  const domain = docs[0].domain || "INDUSTRIA";
  const docsForPrompt = docs.map(d => ({
    id: d.id,
    name: d.name,
    categoriaDoc: d.categoriaDoc,
    tipoDocumento: d.tipoDocumento,
    pageIndexSample: d.pageIndices[0]?.content || d.pageIndices[0]?.title || "(sin contenido extraído)",
  }));

  try {
    const prompt = buildPrompt(
      company.companyName || "Empresa",
      domain,
      docsForPrompt
    );

    const raw = await nimService.generateWithDeepSeek({
      userPrompt: prompt,
      maxTokens: 4096,
      temperature: 0.2,
    });

    console.log(`[AiDictamen] Raw response (first 500): ${raw.slice(0, 500)}`);

    // Extraer JSON — soporta: JSON puro, markdown ```json...```, o texto con JSON embebido
    let jsonStr = raw;
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) jsonStr = mdMatch[1];
    else {
      const objMatch = raw.match(/\{[\s\S]*\}/);
      if (objMatch) jsonStr = objMatch[0];
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`JSON inválido del modelo. Inicio de respuesta: ${raw.slice(0, 200)}`);
    }

    // Normalizar keys — el modelo puede usar variantes
    const vlap = parsed.vlap ?? parsed.vlap_evaluation ?? parsed.evaluacion_vlap ?? parsed.VLAP ?? null;
    const findings = parsed.findings ?? parsed.hallazgos ?? parsed.findings_list ?? [];
    const summary = parsed.summary ?? parsed.resumen ?? parsed.resumen_ejecutivo ?? null;

    if (!vlap || !Array.isArray(findings)) {
      console.error(`[AiDictamen] Keys disponibles: ${Object.keys(parsed).join(', ')}`);
      throw new Error(`Estructura inválida. Keys: ${Object.keys(parsed).join(', ')}`);
    }

    // Normalizar cada hallazgo — el modelo puede usar nombres en español
    const normalizedFindings = findings.map((f: any) => ({
      type: (f.type ?? f.tipo ?? "OBSERVATION").toUpperCase(),
      severity: (f.severity ?? f.severidad ?? f.gravedad ?? "MEDIUM").toUpperCase(),
      title: f.title ?? f.titulo ?? f.hallazgo ?? "Sin título",
      description: f.description ?? f.descripcion ?? f.detalle ?? "",
      recommendation: f.recommendation ?? f.recomendacion ?? f.accion ?? "",
      documentId: f.documentId ?? f.documento_id ?? null,
      documentName: f.documentName ?? f.nombre_documento ?? null,
      page: f.page ?? f.pagina ?? null,
    }));

    await prisma.aiDictamen.update({
      where: { id: dictamen.id },
      data: {
        status: "READY",
        vlap,
        findings: normalizedFindings,
        summary,
      },
    });

    console.log(`[AiDictamen] ✓ Generado para ${companyId}: ${parsed.findings.length} hallazgos`);
    return dictamen.id;

  } catch (err: any) {
    console.error(`[AiDictamen] ❌ Error generando dictamen para ${companyId}:`, err.message);
    await prisma.aiDictamen.update({
      where: { id: dictamen.id },
      data: { status: "FAILED", errorMsg: err.message?.slice(0, 500) },
    });
    throw err;
  }
}

// ── Trigger post-análisis ──────────────────────────────────────────────────────

/**
 * Verifica si todos los documentos de la empresa ya están ANALYZED/INDEXED
 * y si es así, dispara la generación del dictamen IA en background.
 * Se llama desde document-pipeline.ts tras cada análisis completado.
 */
export async function maybeScheduleAiDictamen(documentId: string): Promise<void> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { userId: true, status: true },
    });
    if (!doc || !["ANALYZED", "INDEXED"].includes(doc.status)) return;

    const companyId = doc.userId;

    // Verificar que haya al menos 1 doc ANALYZED (no solo INDEXED)
    const analyzedCount = await prisma.document.count({
      where: { userId: companyId, status: "ANALYZED" },
    });
    if (analyzedCount === 0) return;

    // Verificar que no haya ninguno aún en PROCESSING (esperar a que terminen)
    const processingCount = await prisma.document.count({
      where: { userId: companyId, status: { in: ["PROCESSING", "PENDING"] } },
    });

    if (processingCount > 0) {
      console.log(`[AiDictamen] ${processingCount} docs aún procesando para ${companyId}, esperando`);
      return;
    }

    // Todo listo — generar dictamen (no esperar a que termine)
    console.log(`[AiDictamen] Iniciando generación automática para empresa ${companyId}`);
    generateAiDictamen(companyId).catch((err) =>
      console.error(`[AiDictamen] Error en generación automática:`, err.message)
    );
  } catch (err: any) {
    console.error(`[AiDictamen] Error en maybeScheduleAiDictamen:`, err.message);
  }
}
