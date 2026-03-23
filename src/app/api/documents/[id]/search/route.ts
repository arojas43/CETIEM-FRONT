import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cogneeService } from "@/lib/cognee-service";
import { qaService } from "@/lib/qa-service";

export const maxDuration = 120; // segundos

/**
 * POST /api/documents/[id]/search
 * Búsqueda semántica y Q&A mejorado que combina:
 * - FalkorDB (entidades y relaciones)
 * - PageIndex (texto con ubicación exacta: página, sección, párrafo)
 * - LLM (respuesta contextual con referencias)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const { query, includeRelations = true, page, section } = body;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Verificar que el documento existe y pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, status: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[Search] Query: "${query}", Document: ${id}, Page: ${page || 'any'}, Section: ${section || 'any'}`);

    const result = await qaService.answerSpecificQuestion(query, id, document.name);

    return NextResponse.json({
      success: true,
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
      {
        error: "Error al buscar en el documento",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/search/stats
 * Obtiene estadísticas del grafo de conocimiento del documento
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar documento
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

    // Obtener estadísticas del grafo
    const stats = await cogneeService.getDocumentGraphStats(id);

    return NextResponse.json({
      success: true,
      documentId: id,
      ...stats,
    });
  } catch (error: any) {
    console.error("Error getting graph stats:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas", details: error.message },
      { status: 500 }
    );
  }
}
