/**
 * Genera un dictamen preliminar de IA para una empresa a partir de sus documentos ANALYZED.
 * El assessor lo usa como punto de partida — puede aceptar, editar o descartar cada hallazgo.
 *
 * Modelo: DeepSeek V4 Flash (1M ctx) vía NVIDIA_DEEPSEEK_MODEL env var.
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

// Límite de caracteres por documento — deepseek-v4-flash tiene 1M tokens (~4M chars).
// 300K chars por doc = holgura para 10 docs dentro del límite.
const MAX_CHARS_PER_DOC = 300_000;

function buildPrompt(
  companyName: string,
  domain: string,
  docs: Array<{
    id: string;
    name: string;
    categoriaDoc: string;
    tipoDocumento: string | null;
    fullContent: string;
    totalNodes: number;
  }>
): string {
  const sep = "═".repeat(72);

  const docBlocks = docs.map((d, i) => {
    const content = d.fullContent.length > MAX_CHARS_PER_DOC
      ? d.fullContent.slice(0, MAX_CHARS_PER_DOC) + `\n\n[...contenido truncado: ${d.fullContent.length - MAX_CHARS_PER_DOC} caracteres adicionales]`
      : d.fullContent;

    return `${sep}
DOCUMENTO ${i + 1} DE ${docs.length}
Nombre    : "${d.name}"
Tipo      : ${d.tipoDocumento || d.categoriaDoc}
Categoría : ${d.categoriaDoc}
ID        : ${d.id}
Secciones : ${d.totalNodes}
${sep}

${content || "(sin contenido extraído — documento posiblemente ilegible o vacío)"}

${sep}
FIN DOCUMENTO ${i + 1} — "${d.name}"
${sep}`;
  }).join("\n\n");

  return `Eres un experto certificador ESG del programa CETIEM de la Secretaría de Economía de México.
Tu tarea es analizar en detalle los ${docs.length} documentos de la empresa "${companyName}" (sector: ${domain}) y emitir un DICTAMEN PRELIMINAR de certificación ESG.

Tienes acceso al CONTENIDO COMPLETO de cada documento, separados por marcadores visuales claros (═══...). Analiza cada documento por separado y luego en conjunto.

${docBlocks}

INSTRUCCIONES DE ANÁLISIS:
1. Evalúa los 4 criterios V.L.A.P. para el CONJUNTO de documentos:
   - vigencia: ¿Los documentos tienen fechas recientes y están vigentes? ¿Alguno está vencido?
   - legibilidad: ¿Son legibles, bien estructurados? ¿Hay páginas en blanco o ilegibles?
   - autoria: ¿Tienen firma, sello, RFC, o datos del responsable que acrediten autoría?
   - pertinencia: ¿Son documentos relevantes para certificar ESG en el sector ${domain}?

2. Identifica hallazgos concretos con referencia al documento y sección específica donde se encontró:
   - COMPLIANCE: aspectos que sí cumplen los estándares (menciona el dato exacto del documento)
   - NON_COMPLIANCE: incumplimientos bloqueantes para la certificación (cita la evidencia)
   - OBSERVATION: aspectos a mejorar pero no bloqueantes
   - RECOMMENDATION: buenas prácticas adicionales sugeridas

3. Genera un resumen ejecutivo de 2-3 oraciones.

REGLAS IMPORTANTES:
- El campo "documentId" de cada hallazgo debe ser el ID exacto del documento referenciado.
- El campo "page" puede ser un número de página si lo identificas en el contenido.
- Sé específico: menciona datos concretos del documento (fechas, montos, RFCs, nombres).
- Si un documento está en blanco o ilegible, es hallazgo CRITICAL NON_COMPLIANCE.

RESPONDE ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "vlap": {
    "vigencia":    { "suggestion": true, "confidence": 85, "rationale": "explicación con evidencia del documento" },
    "legibilidad": { "suggestion": true, "confidence": 90, "rationale": "..." },
    "autoria":     { "suggestion": false, "confidence": 70, "rationale": "..." },
    "pertinencia": { "suggestion": true, "confidence": 95, "rationale": "..." }
  },
  "findings": [
    {
      "type": "COMPLIANCE",
      "severity": "LOW",
      "title": "Título corto del hallazgo",
      "description": "Descripción detallada con referencia al documento y dato específico",
      "recommendation": "Acción concreta que debe tomar la empresa",
      "documentId": "id-exacto-del-documento",
      "documentName": "nombre del archivo",
      "page": null
    }
  ],
  "summary": "Resumen ejecutivo del dictamen en 2-3 oraciones."
}`;
}

// ── Generación ─────────────────────────────────────────────────────────────────

export async function generateAiDictamen(companyId: string): Promise<string> {
  // Si hay uno en vuelo, devolver su id para que el cliente haga polling
  const inFlight = await prisma.aiDictamen.findFirst({
    where: { companyId, status: "GENERATING" },
    orderBy: { generatedAt: "desc" },
  });
  if (inFlight) {
    const ageMs = Date.now() - inFlight.generatedAt.getTime();
    // Si lleva más de 10 min probablemente murió — dejar que se reintente
    if (ageMs < 10 * 60 * 1000) {
      console.log(`[AiDictamen] Ya hay uno en GENERATING para ${companyId}, esperando`);
      return inFlight.id;
    }
    // Marcar el zombie como FAILED
    await prisma.aiDictamen.update({
      where: { id: inFlight.id },
      data: { status: "FAILED", errorMsg: "Timeout — proceso anterior sin respuesta" },
    });
  }

  // Si ya existe uno READY reciente (<1h), no regenerar
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
        orderBy: [{ level: "asc" }, { page: "asc" }],
        select: { content: true, title: true, page: true, level: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
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

  // Ensamblar contenido completo de cada documento desde todos sus nodos PageIndex
  const docsForPrompt = docs.map(d => {
    const sections = d.pageIndices
      .map(n => {
        const header = n.title ? `## ${n.title}${n.page ? ` (pág. ${n.page})` : ""}` : "";
        return [header, n.content].filter(Boolean).join("\n");
      })
      .filter(s => s.trim().length > 0);

    const fullContent = sections.join("\n\n");
    const totalChars = fullContent.length;
    console.log(`[AiDictamen] "${d.name}": ${d.pageIndices.length} secciones, ${totalChars} chars`);

    return {
      id: d.id,
      name: d.name,
      categoriaDoc: d.categoriaDoc,
      tipoDocumento: d.tipoDocumento,
      fullContent,
      totalNodes: d.pageIndices.length,
    };
  });

  try {
    const prompt = buildPrompt(
      company.companyName || "Empresa",
      domain,
      docsForPrompt
    );
    console.log(`[AiDictamen] Prompt total: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`);

    // Usar NVIDIA_INTENT_API_KEY como key alternativa para el dictamen —
    // cuota separada a la del pipeline de indexación (NVIDIA_API_KEY)
    const dictamenApiKey = process.env.NVIDIA_INTENT_API_KEY || process.env.NVIDIA_API_KEY;
    const dictamenModel  = process.env.NVIDIA_DEEPSEEK_MODEL || process.env.NVIDIA_INTENT_MODEL  || "deepseek-ai/deepseek-v4-flash";

    const raw = await nimService.generateWithDeepSeek({
      userPrompt: prompt,
      maxTokens: 4096,
      temperature: 0.2,
      apiKey: dictamenApiKey,
      model:  dictamenModel,
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

    // Normalizar keys — el modelo puede usar variantes o devolver VLAP en el nivel superior
    let vlap = parsed.vlap ?? parsed.vlap_evaluation ?? parsed.evaluacion_vlap ?? parsed.VLAP ?? null;

    // Si VLAP no está anidado, intentar construirlo desde claves de nivel superior
    if (!vlap && (parsed.vigencia || parsed.legibilidad || parsed.autoria || parsed.autenticidad || parsed.pertinencia)) {
      vlap = {
        vigencia:    parsed.vigencia,
        legibilidad: parsed.legibilidad,
        autoria:     parsed.autoria ?? parsed.autenticidad ?? parsed.autenticacion ?? null,
        pertinencia: parsed.pertinencia,
      };
    }

    // Normalizar autoria si viene como autenticidad dentro del objeto vlap
    if (vlap && !vlap.autoria && (vlap.autenticidad || vlap.autenticacion)) {
      vlap.autoria = vlap.autenticidad ?? vlap.autenticacion;
    }

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

    console.log(`[AiDictamen] ✓ Generado para ${companyId}: ${normalizedFindings.length} hallazgos`);
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
