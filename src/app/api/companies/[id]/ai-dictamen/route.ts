import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateAiDictamen } from "@/lib/ai-dictamen-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;
  const role = session.user.role;

  // Solo ASSESSOR/ADMIN asignado o la propia empresa puede ver su dictamen IA
  if (role === "COMPANY" && session.user.id !== companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "ASSESSOR") {
    const company = await prisma.user.findUnique({
      where: { id: companyId },
      select: { assessorId: true },
    });
    if (company?.assessorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const dictamen = await prisma.aiDictamen.findFirst({
    where: { companyId },
    orderBy: { generatedAt: "desc" },
  });

  return NextResponse.json({ dictamen });
}

// POST — fuerza regeneración
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: companyId } = await params;
  const role = session.user.role;

  if (role !== "ASSESSOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role === "ASSESSOR") {
    const company = await prisma.user.findUnique({
      where: { id: companyId },
      select: { assessorId: true },
    });
    if (company?.assessorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Eliminar dictamenes anteriores para forzar regeneración limpia
  await prisma.aiDictamen.deleteMany({ where: { companyId } });

  // Disparar en background
  generateAiDictamen(companyId).catch(console.error);

  return NextResponse.json({ ok: true, message: "Generando dictamen IA..." });
}
