import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cogneeService } from "@/lib/cognee-service";
import { cogneeClient } from "@/lib/cognee-client";
import { qaService } from "@/lib/qa-service";
import { withValidation } from "@/lib/api/with-validation";
import { searchSchema } from "@/lib/schemas/documents";

export const dynamic = "force-dynamic";

export const maxDuration = 120; // segundos

/**
 * POST /api/documents/[id]/search
 * Búsqueda semántica y Q&A mejorado que combina:
 * - FalkorDB (entidades y relaciones)
 * - PageIndex (texto con ubicación exacta: página, sección, párrafo)
 * - LLM (respuesta contextual con referencias)
 */
export const POST = withValidation({ body: searchSchema })(
  async (
    _request: NextRequest,
    { body: { query, page, section } },
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

    // Verificar que el documento existe y pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, status: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[Search] Query: "${query}", Document: ${id}, Page: ${page || 'any'}, Section: ${section || 'any'}`);

    // Prefer Cognee Python service; fall back to TS qa-service
    const useCognee = cogneeClient.available && (await cogneeClient.isHealthy().catch(() => false));
    console.log(`[Search] Backend: ${useCognee ? 'Cognee Python' : 'TS qa-service'}`);

    if (useCognee) {
      const cogneeResult = await cogneeClient.search(query, id);
      return NextResponse.json({
        success: true,
        query,
        answer: cogneeResult.answer,
        entities: cogneeResult.entities,
        relations: [],
        context: cogneeResult.context,
        references: cogneeResult.sources,
        stats: {
          entityCount: cogneeResult.entities.length,
          relationCount: 0,
          contextPages: cogneeResult.sources.map(s => s.page).filter(Boolean),
        },
      });
    }

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
});

/**
 * GET /api/documents/[id]/search/stats
 * Obtiene estadísticas del grafo de conocimiento del documento
 */
export async function GET(
  _request: NextRequest,
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

    const userRole = (session.user as any).role;
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
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
