import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { canAccessDocument } from "@/lib/access";
import { calcEsgScore, hasVlapHardStop } from "@/lib/esg-score";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/[id]/certifications
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const doc = await prisma.document.findUnique({ where: { id }, select: { userId: true } });
    if (!doc || !(await canAccessDocument(doc.userId, session))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cert = await prisma.certification.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      include: { findings: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json(cert ?? null);
  } catch (err) {
    console.error("GET certifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id]/certifications
 * Body: { verdict, notes, findings[], vlap?, confidenceScore?, aiRecommendation? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role as string | undefined;
    if (!role || !["ASSESSOR", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden: only assessors can issue dictámenes" }, { status: 403 });
    }

    const { id } = await params;
    const { verdict, notes, findings = [], vlap, confidenceScore, aiRecommendation } = await req.json();

    if (!verdict || !["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(verdict)) {
      return NextResponse.json({ error: "Veredicto inválido" }, { status: 400 });
    }

    // Server-side V.L.A.P. hard stop
    if (vlap && hasVlapHardStop(vlap)) {
      return NextResponse.json(
        { error: "Hard Stop V.L.A.P.: al menos una dimensión no alcanza el umbral de confianza (85%). Use el override si corresponde." },
        { status: 422 }
      );
    }

    const document = await prisma.document.findUnique({ where: { id }, include: { user: { select: { id: true, assessorId: true } } } });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // ASSESSOR must be assigned to the company owning the document
    if (role === "ASSESSOR" && document.user.assessorId !== session.user.id) {
      return NextResponse.json({ error: "No tienes asignada esta empresa" }, { status: 403 });
    }

    const statusMap: Record<string, "APPROVED" | "IN_REVIEW" | "REJECTED" | "CAPA_OPEN"> = {
      APPROVED: "APPROVED",
      CHANGES_REQUESTED: "IN_REVIEW",
      REJECTED: "REJECTED",
    };

    // If has NC findings → CAPA_OPEN instead
    const hasNC = findings.some((f: any) => f.type === "NON_COMPLIANCE");
    const certStatus = hasNC && verdict === "CHANGES_REQUESTED" ? "CAPA_OPEN" : statusMap[verdict];

    // Compute ESG score — same formula as company-level certification
    const esgScore = calcEsgScore(vlap, findings);

    // Generate public token and SHA-256 hash for approved certifications
    let publicToken: string | null = null;
    let sha256Hash: string | null = null;
    if (certStatus === "APPROVED") {
      const { randomUUID } = await import("crypto");
      publicToken = randomUUID();
      // Hash the cert data for forensic integrity
      const { createHash } = await import("crypto");
      const hashData = JSON.stringify({ documentId: id, verdict, assessorId: session.user.id, assessedAt: new Date().toISOString(), esgScore });
      sha256Hash = createHash("sha256").update(hashData).digest("hex");
    }

    // Close old CAPA tickets linked to this document before re-issuing
    await prisma.capaTicket.updateMany({
      where: { documentId: id, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      data: { status: "CLOSED", resolution: "Cerrado automáticamente al emitir nuevo dictamen." },
    });

    // Delete previous certifications
    await prisma.certification.deleteMany({ where: { documentId: id } });

    // Create new certification with findings
    const cert = await prisma.certification.create({
      data: {
        name: `Dictamen ECONOMIA — ${new Date().toLocaleDateString("es-MX")}`,
        type: "CUSTOM",
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
          vlap: vlap || null,
          confidenceScore: confidenceScore || null,
          aiRecommendation: aiRecommendation || null,
        },
        documentId: id,
        findings: {
          create: findings.map((f: any) => ({
            type: f.type,
            severity: f.severity,
            title: f.title,
            description: f.description || "",
            evidence: f.page ? `Página ${f.page}` : null,
            recommendation: f.recommendation || null,
            status: "OPEN",
          })),
        },
      },
      include: { findings: true },
    });

    // Create CAPA tickets for NC findings
    const ncFindings = cert.findings.filter(f => f.type === "NON_COMPLIANCE");
    if (ncFindings.length > 0) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      await prisma.capaTicket.createMany({
        data: ncFindings.map(f => ({
          documentId: id,
          findingId: f.id,
          userId: document.user.id,
          title: f.title,
          description: f.description,
          dueDate,
          status: "OPEN",
        })),
      });
    }

    // Audit log
    await logAudit({
      userId: session.user.id,
      action: "CERT_ISSUED",
      entityType: "Certification",
      entityId: cert.id,
      payload: { verdict, documentId: id, esgScore, hasNC, ncCount: ncFindings.length },
    });

    return NextResponse.json(cert, { status: 201 });
  } catch (err) {
    console.error("POST certifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]/certifications — CERT_REVOKED kill-switch
 * Body: { reason }
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role as string | undefined;
    if (!role || role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: only admins can revoke certifications" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json().catch(() => ({ reason: "" }));

    const cert = await prisma.certification.findFirst({
      where: { documentId: id, status: "APPROVED" },
    });
    if (!cert) return NextResponse.json({ error: "No approved certification found" }, { status: 404 });

    const revoked = await prisma.certification.update({
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
      entityType: "Certification",
      entityId: cert.id,
      payload: { documentId: id, reason },
    });

    return NextResponse.json(revoked);
  } catch (err) {
    console.error("DELETE certifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
