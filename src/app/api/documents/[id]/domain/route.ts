import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_DOMAINS = ["INDUSTRIA", "CONSTRUCCION", "TECNOLOGIA"];

/**
 * PUT /api/documents/[id]/domain
 * Actualiza el dominio de análisis de un documento
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { domain } = body;

    if (!domain || !VALID_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: `Dominio inválido. Válidos: ${VALID_DOMAINS.join(", ")}` },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { domain },
      select: { id: true, domain: true },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error("Error updating domain:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
