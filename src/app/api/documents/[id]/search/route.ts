import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { qaService } from "@/lib/qa-service";
import { withValidation } from "@/lib/api/with-validation";
import { searchSchema } from "@/lib/schemas/documents";

export const dynamic = "force-dynamic";

export const maxDuration = 120;

/**
 * POST /api/documents/[id]/search
 *
 * Q&A sobre un documento específico vía PageIndex + NIM (2 llamadas LLM).
 * NIM tiene límite de 40 req/hora por clave — OpenKB (agente multi-turno) consume
 * 3-5 llamadas por query sin aportar valor en búsqueda por documento; se omite aquí.
 * OpenKB sigue disponible para análisis cross-documento desde otros endpoints.
 */
export const POST = withValidation({ body: searchSchema })(
  async (
    _request: NextRequest,
    { body: { query } },
    { params }: { params: Promise<{ id: string }> }
  ) => {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, status: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    if (userRole === "COMPANY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[Search] Query: "${query}", Document: ${id}`);
    const result = await qaService.answerSpecificQuestion(query, id, document.name);

    return NextResponse.json({
      success: true,
      backend: 'pageindex',
      query,
      answer: result.answer,
      entities: result.entities,
      relations: result.relations,
      context: result.context.map(c => c.text).join('\n\n'),
      references: result.references,
      stats: {
        entityCount: result.entities.length,
        relationCount: result.relations.length,
        contextPages: [...new Set(result.references.map(r => r.page).filter(Boolean))],
      },
    });
  } catch (error: any) {
    console.error("Error searching document:", error);
    return NextResponse.json(
      { error: "Error al buscar en el documento", details: error.message },
      { status: 500 }
    );
  }
});
