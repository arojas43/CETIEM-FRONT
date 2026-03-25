import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    const document = await prisma.document.findUnique({ where: { id }, include: { user: { select: { id: true } } } });
    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const statusMap: Record<string, "APPROVED" | "IN_REVIEW" | "REJECTED" | "CAPA_OPEN"> = {
      APPROVED:          "APPROVED",
      CHANGES_REQUESTED: "IN_REVIEW",
      REJECTED:          "REJECTED",
    };

    // If has NC findings → CAPA_OPEN instead
    const hasNC = findings.some((f: any) => f.type === "NON_COMPLIANCE");
    const certStatus = hasNC && verdict === "CHANGES_REQUESTED" ? "CAPA_OPEN" : statusMap[verdict];

    // Compute ESG score from V.L.A.P.
    let esgScore: number | null = null;
    if (vlap) {
      const v = vlap as Record<string, { value: boolean | null; confidence: number; override: boolean }>;
      const passed = [v.vigencia?.value, v.legibilidad?.value, v.autoria?.value, v.pertinencia?.value]
        .filter(val => val === true).length;
      esgScore = (passed / 4) * 100;
    }

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

    // Delete previous certifications
    await prisma.certification.deleteMany({ where: { documentId: id } });

    // Create new certification with findings
    const cert = await prisma.certification.create({
      data: {
        name: `Dictamen CETIEM — ${new Date().toLocaleDateString("es-MX")}`,
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
