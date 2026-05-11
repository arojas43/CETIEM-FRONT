/**
 * GET /api/dashboard/pulse
 * Endpoint ligero: devuelve un hash del estado actual de docs y certificación.
 * El cliente lo compara con el hash anterior; solo hace router.refresh() si cambió.
 * Mucho más barato que relanzar el render completo del dashboard cada N segundos.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ hash: "" });

  const userId = session.user.id;

  const [docs, cert, capaCount] = await Promise.all([
    prisma.document.findMany({
      where: { userId },
      select: { status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.companyCertification.findFirst({
      where: { companyId: userId },
      orderBy: { updatedAt: "desc" },
      select: { status: true, updatedAt: true },
    }),
    prisma.capaTicket.count({
      where: { userId, status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
    }),
  ]);

  const hash = [
    docs.map(d => d.status).sort().join(","),
    docs[0]?.updatedAt.getTime() ?? 0,
    cert?.status ?? "none",
    cert?.updatedAt.getTime() ?? 0,
    capaCount,
  ].join("|");

  return NextResponse.json({ hash });
}
