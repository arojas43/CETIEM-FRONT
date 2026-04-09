import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/export/documents — CSV export (assessor/admin only) */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role as string;
    if (!["ASSESSOR", "ADMIN"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const docWhere = role === "ASSESSOR"
      ? { user: { assessorId: session.user.id } }
      : {};

    const docs = await prisma.document.findMany({
      where: docWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, companyName: true, track: true } },
        certifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, esgScore: true, sha256Hash: true, createdAt: true, requirements: true },
        },
      },
    });

    const rows = [
      ["ID", "Nombre", "Empresa", "Email", "Track", "Estado IA", "SHA-256", "Estado Dictamen", "Score ESG", "Fecha Subida", "Fecha Dictamen"].join(","),
      ...docs.map(d => {
        const cert = d.certifications[0];
        return [
          d.id,
          `"${d.name.replace(/"/g, '""')}"`,
          `"${(d.user.companyName || d.user.name || "").replace(/"/g, '""')}"`,
          d.user.email,
          d.user.track || "",
          d.status,
          d.sha256 || "",
          cert?.status || "SIN_DICTAMEN",
          cert?.esgScore != null ? cert.esgScore.toFixed(1) : "",
          new Date(d.createdAt).toLocaleDateString("es-MX"),
          cert ? new Date(cert.createdAt).toLocaleDateString("es-MX") : "",
        ].join(",");
      }),
    ].join("\n");

    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="cetiem_documentos_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error("export error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
