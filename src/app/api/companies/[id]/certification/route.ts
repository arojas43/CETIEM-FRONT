import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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
      id: true, name: true, status: true, domain: true, createdAt: true, updatedAt: true,
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

  const company = await prisma.user.findUnique({
    where: { id: companyId, role: "COMPANY" },
    select: { id: true, companyName: true, email: true },
  });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  // Calcular ESG score desde V.L.A.P.
  let esgScore: number | null = null;
  if (vlap) {
    const v = vlap as Record<string, { value: boolean | null; confidence: number; override: boolean }>;
    const passed = ["vigencia", "legibilidad", "autoria", "pertinencia"]
      .filter(k => v[k]?.value === true).length;
    esgScore = (passed / 4) * 100;
  }

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

    // Usar el primer documentId de la lista si el hallazgo no tiene uno específico
    const fallbackDocId = documentIds[0] ?? null;

    const capaData = ncFindings
      .map((f: any) => {
        const docId = f.documentId ?? fallbackDocId;
        if (!docId) return null;
        return {
          documentId: docId,
          userId: companyId,
          companyCertificationId: cert.id,
          title: f.title,
          description: f.description || "",
          dueDate,
          status: "OPEN" as const,
        };
      })
      .filter(Boolean) as any[];

    if (capaData.length > 0) {
      await prisma.capaTicket.createMany({ data: capaData });
    }
  }

  await logAudit({
    userId: session.user.id,
    action: "CERT_ISSUED",
    entityType: "CompanyCertification",
    entityId: cert.id,
    payload: { verdict, companyId, esgScore, hasNC, ncCount: ncFindings.length, documentIds },
  });

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

  return NextResponse.json(revoked);
}
