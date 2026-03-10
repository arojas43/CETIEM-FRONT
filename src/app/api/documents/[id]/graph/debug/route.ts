import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { falkorDBService, checkFalkorDBHealth } from "@/lib/falkordb";

/**
 * GET /api/documents/[id]/graph/debug
 * Endpoint de debug para ver todas las entidades en el grafo
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHealthy = await checkFalkorDBHealth();

    if (!isHealthy) {
      return NextResponse.json({
        connected: false,
        message: "FalkorDB no está disponible",
      });
    }

    // 1. Ver TODAS las entidades en el grafo
    const allEntitiesQuery = 'MATCH (n) RETURN labels(n)[0] AS type, n.name AS name, n.documentId AS docId, n.id AS id LIMIT 50';
    const allEntitiesResult = await falkorDBService.query(allEntitiesQuery);

    // 2. Ver entidades del documento específico
    const docEntitiesQuery = `MATCH (n) WHERE n.documentId = "${id}" RETURN labels(n)[0] AS type, n.name AS name, n.documentId AS docId, n.id AS id`;
    const docEntitiesResult = await falkorDBService.query(docEntitiesQuery);

    // 3. Ver TODAS las relaciones
    const allRelationsQuery = 'MATCH (a)-[r]->(b) RETURN a.name AS source, type(r) AS type, b.name AS target, a.documentId AS sourceDoc, b.documentId AS targetDoc LIMIT 50';
    const allRelationsResult = await falkorDBService.query(allRelationsQuery);

    // 4. Contar entidades por documentId
    const countByDocQuery = 'MATCH (n) WHERE n.documentId IS NOT NULL RETURN n.documentId AS docId, count(n) AS count ORDER BY count DESC';
    const countByDocResult = await falkorDBService.query(countByDocQuery);

    // 5. Ver si hay entidades SIN documentId
    const noDocIdQuery = 'MATCH (n) WHERE n.documentId IS NULL OR n.documentId = "" RETURN labels(n)[0] AS type, n.name AS name, n.id AS id LIMIT 20';
    const noDocIdResult = await falkorDBService.query(noDocIdQuery);

    return NextResponse.json({
      success: true,
      debug: {
        allEntities: allEntitiesResult.rows,
        documentEntities: docEntitiesResult.rows,
        allRelations: allRelationsResult.rows,
        countByDocument: countByDocResult.rows,
        entitiesWithoutDocId: noDocIdResult.rows,
        stats: {
          totalEntities: allEntitiesResult.rows.length,
          docEntities: docEntitiesResult.rows.length,
          totalRelations: allRelationsResult.rows.length,
          documentsWithEntities: countByDocResult.rows.length,
          entitiesWithoutDocId: noDocIdResult.rows.length,
        },
      },
    });
  } catch (error: any) {
    console.error("Debug graph error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
