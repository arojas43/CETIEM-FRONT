import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { calcEsgScore, hasVlapHardStop } from "@/lib/esg-score";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/companies/[id]/certification
 * Devuelve el último dictamen ESG de la empresa, incluyendo el resumen de documentos analizados.
 * Acceso: ASSESSOR, ADMIN, o la propia empresa.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: companyId } = await params;
  const role = (session.user as any).role as string;

  // La empresa solo puede ver su propio dictamen
  if (role === "COMPANY" && session.user.id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cert = await prisma.companyCertification.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });

  // Documentos analizados de la empresa (para el resumen)
  const documents = await prisma.document.findMany({
    where: { userId: companyId, status: { in: ["ANALYZED", "INDEXED"] } },
    select: {
      id: true, name: true, status: true, domain: true, storageUrl: true, createdAt: true, updatedAt: true,
      pageIndices: { orderBy: { level: "asc" }, take: 5, select: { id: true, level: true, title: true, page: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ cert: cert ?? null, documents });
}

/**
 * POST /api/companies/[id]/certification
 * Emite o actualiza el dictamen ESG de una empresa.
 * Body: { verdict, notes, findings[], vlap, confidenceScore, documentIds[] }
 * Acceso: ASSESSOR, ADMIN únicamente.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (!["ASSESSOR", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: solo assessors pueden emitir dictámenes" }, { status: 403 });
  }

  const { id: companyId } = await params;
  const { verdict, notes, findings = [], vlap, confidenceScore, documentIds = [] } = await req.json();

  if (!verdict || !["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(verdict)) {
    return NextResponse.json({ error: "Veredicto inválido" }, { status: 400 });
  }

  // Server-side V.L.A.P. hard stop — cannot be bypassed from the client
  if (vlap && hasVlapHardStop(vlap)) {
    return NextResponse.json(
      { error: "Hard Stop V.L.A.P.: al menos una dimensión no alcanza el umbral de confianza (85%). Use el override si corresponde." },
      { status: 422 }
    );
  }

  const company = await prisma.user.findUnique({
    where: { id: companyId, role: "COMPANY" },
    select: { id: true, companyName: true, email: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  // Assessors can only issue dictamen for their assigned companies
  if (role === "ASSESSOR") {
    const assignment = await prisma.user.findUnique({ where: { id: companyId }, select: { assessorId: true } });
    if (assignment?.assessorId !== session.user.id) {
      return NextResponse.json({ error: "No tienes asignada esta empresa" }, { status: 403 });
    }
  }

  // Validate provided documentIds belong to the company
  if (documentIds.length > 0) {
    const validDocs = await prisma.document.findMany({
      where: { id: { in: documentIds }, userId: companyId },
      select: { id: true },
    });
    const validIds = new Set(validDocs.map((d: { id: string }) => d.id));
    const invalid = documentIds.filter((id: string) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `DocumentIds inválidos: ${invalid.join(", ")}` }, { status: 400 });
    }
  }

  // Calcular ESG score: combinación de V.L.A.P. (50%) + ratio de cumplimientos (50%)
  const esgScore = calcEsgScore(vlap, findings);

  // Determinar status
  const hasNC = findings.some((f: any) => f.type === "NON_COMPLIANCE");
  const statusMap: Record<string, "APPROVED" | "IN_REVIEW" | "REJECTED" | "CAPA_OPEN"> = {
    APPROVED:          "APPROVED",
    CHANGES_REQUESTED: hasNC ? "CAPA_OPEN" : "IN_REVIEW",
    REJECTED:          "REJECTED",
  };
  const certStatus = statusMap[verdict];

  // Generar token y hash si se aprueba
  let publicToken: string | null = null;
  let sha256Hash: string | null = null;
  if (certStatus === "APPROVED") {
    const { randomUUID } = await import("crypto");
    const { createHash } = await import("crypto");
    publicToken = randomUUID();
    sha256Hash = createHash("sha256")
      .update(JSON.stringify({ companyId, verdict, assessorId: session.user.id, assessedAt: new Date().toISOString(), esgScore }))
      .digest("hex");
  }

  // Cerrar CAPA tickets abiertos antes de reemplazar el dictamen (evita FK constraint)
  await prisma.capaTicket.updateMany({
    where: { userId: companyId, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
    data: { status: "CLOSED", resolution: "Cerrado automáticamente al emitir nuevo dictamen." },
  });

  // Eliminar dictamen anterior si existe
  await prisma.companyCertification.deleteMany({ where: { companyId } });

  // Crear nuevo dictamen
  const cert = await prisma.companyCertification.create({
    data: {
      companyId,
      status: certStatus,
      esgScore,
      publicToken,
      sha256Hash,
      requirements: {
        verdict,
        notes: notes || "",
        assessorId: session.user.id,
        assessorEmail: session.user.email,
        assessedAt: new Date().toISOString(),
        vlap: vlap ?? null,
        confidenceScore: confidenceScore ?? null,
        findings,
        documentIds,
      },
    },
  });

  // Crear CAPA tickets para hallazgos NON_COMPLIANCE
  const ncFindings = findings.filter((f: any) => f.type === "NON_COMPLIANCE");
  if (ncFindings.length > 0) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Ensure we have a fallback documentId — prefer from request, then query any company doc
    let fallbackDocId: string | null = documentIds[0] ?? null;
    if (!fallbackDocId) {
      const anyDoc = await prisma.document.findFirst({
        where: { userId: companyId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });
      fallbackDocId = anyDoc?.id ?? null;
    }

    if (fallbackDocId) {
      const capaData = ncFindings.map((f: any) => ({
        documentId: f.documentId ?? fallbackDocId,
        userId: companyId,
        companyCertificationId: cert.id,
        title: f.title,
        description: f.description || "",
        dueDate,
        status: "OPEN" as const,
      }));
      await prisma.capaTicket.createMany({ data: capaData });
    } else {
      console.warn(`[Cert] No documentId available for CAPA tickets — company ${companyId} has no documents`);
    }
  }

  await logAudit({
    userId: session.user.id,
    action: "CERT_ISSUED",
    entityType: "CompanyCertification",
    entityId: cert.id,
    payload: { verdict, companyId, esgScore, hasNC, ncCount: ncFindings.length, documentIds },
  });

  // Notify company about the dictamen
  const notifTitle = certStatus === "APPROVED"
    ? "Certificado ESG Aprobado"
    : certStatus === "REJECTED"
    ? "Dictamen: No aprobado"
    : certStatus === "CAPA_OPEN"
    ? "Acciones correctivas requeridas"
    : "Revisión en curso";
  const notifBody = certStatus === "APPROVED"
    ? `Tu empresa ha obtenido la certificación ESG${esgScore != null ? ` con un score de ${Math.round(esgScore)}%` : ""}.`
    : certStatus === "CAPA_OPEN"
    ? `Se han generado ${ncFindings.length} ticket(s) CAPA con plazo de 30 días.`
    : notes || "Tu assessor ha emitido un nuevo dictamen. Revisa tu certificado.";
  await notify({ userId: companyId, type: `CERT_${certStatus}`, title: notifTitle, body: notifBody, link: "/dashboard/mi-certificado" });

  // Notify company about each CAPA ticket created
  if (ncFindings.length > 0) {
    await notify({
      userId: companyId,
      type: "CAPA_CREATED",
      title: `${ncFindings.length} ticket${ncFindings.length !== 1 ? "s" : ""} CAPA generado${ncFindings.length !== 1 ? "s" : ""}`,
      body: "Revisa y cierra los tickets dentro del plazo de 30 días para reanudar la revisión.",
      link: "/dashboard/capa",
    });
  }

  return NextResponse.json(cert, { status: 201 });
}

/**
 * DELETE /api/companies/[id]/certification
 * Revoca el dictamen ESG activo de una empresa (kill-switch).
 * Acceso: ADMIN únicamente.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: solo admins pueden revocar" }, { status: 403 });
  }

  const { id: companyId } = await params;
  const { reason } = await req.json().catch(() => ({ reason: "" }));

  const cert = await prisma.companyCertification.findFirst({
    where: { companyId, status: "APPROVED" },
  });
  if (!cert) return NextResponse.json({ error: "No hay dictamen aprobado para revocar" }, { status: 404 });

  const revoked = await prisma.companyCertification.update({
    where: { id: cert.id },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedBy: session.user.id,
      revokeReason: reason || "Revocado por administrador",
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "CERT_REVOKED",
    entityType: "CompanyCertification",
    entityId: cert.id,
    payload: { companyId, reason },
  });

  await notify({
    userId: companyId,
    type: "CERT_REVOKED",
    title: "Certificado ESG revocado",
    body: reason
      ? `Tu certificado ESG ha sido revocado. Razón: ${reason}`
      : "Tu certificado ESG ha sido revocado por el administrador.",
    link: "/dashboard/mi-certificado",
  });

  return NextResponse.json(revoked);
}
