import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/companies/[id]
 * Devuelve información básica de una empresa.
 * Acceso: ASSESSOR, ADMIN, o la propia empresa.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role as string;

  if (role === "COMPANY" && session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await prisma.user.findUnique({
    where: { id, role: "COMPANY" },
    select: {
      id: true, name: true, email: true, companyName: true,
      track: true, sprintLevel: true, rfc: true, industry: true,
      assessor: { select: { id: true, name: true, email: true } },
    },
  });

  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  return NextResponse.json(company);
}
