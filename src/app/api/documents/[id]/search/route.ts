import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { openKBClient } from "@/lib/openkb-client";
import { qaService } from "@/lib/qa-service";
import { withValidation } from "@/lib/api/with-validation";
import { searchSchema } from "@/lib/schemas/documents";

export const dynamic = "force-dynamic";

export const maxDuration = 120;

/**
 * POST /api/documents/[id]/search
 *
 * Intenta Q&A con OpenKB (KB wiki por empresa, razonamiento cross-documento).
 * Si OpenKB no está disponible, cae a qaService (PageIndex + NIM directo).
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
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log(`[Search] Query: "${query}", Document: ${id}`);

    // Intentar OpenKB (KB por empresa → cross-documento)
    if (openKBClient.available) {
      const healthy = await openKBClient.isHealthy().catch(() => false);
      if (healthy) {
        try {
          const companyId = document.userId;
          const openkbResult = await openKBClient.search(query, companyId);
          if (openkbResult.answer && openkbResult.answer.length > 20) {
            console.log(`[Search] OpenKB respondió (${openkbResult.answer.length} chars)`);
            return NextResponse.json({
              success: true,
              backend: 'openkb',
              query,
              answer: openkbResult.answer,
              entities: [],
              relations: [],
              context: openkbResult.answer,
              references: openkbResult.sources,
              stats: { entityCount: 0, relationCount: 0, contextPages: [] },
            });
          }
        } catch (err: any) {
          console.warn(`[Search] OpenKB falló, usando qaService:`, err.message);
        }
      }
    }

    // Fallback: PageIndex + NIM (qa-service)
    console.log(`[Search] Usando qaService (PageIndex + NIM)`);
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
