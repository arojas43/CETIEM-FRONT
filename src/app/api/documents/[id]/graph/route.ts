import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { falkorDBService, checkFalkorDBHealth } from "@/lib/falkordb";
import { canAccessDocument } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/[id]/graph
 * Obtiene el grafo de conocimiento de un documento específico
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

    // Verificar que el documento existe y pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, status: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!(await canAccessDocument(document.userId, session))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verificar salud de FalkorDB
    const isHealthy = await checkFalkorDBHealth();

    if (!isHealthy) {
      return NextResponse.json({
        success: true,
        entities: [],
        relations: [],
        stats: {
          entityCount: 0,
          relationCount: 0,
          documentInGraph: false,
        },
        warning: "FalkorDB no está disponible. Las entidades se mostrarán cuando el servicio esté activo.",
      });
    }

    console.log(`[Graph API] Buscando entidades para documento: ${id}`);

    // Buscar entidades por documentId - Usando WHERE para mejor matching
    const entitiesQuery = `MATCH (n) WHERE n.documentId = "${id}" RETURN labels(n)[0] AS type, n.name AS name, n.description AS description, n.id AS id, n.documentId AS docId`;
    console.log(`[Graph API] Ejecutando consulta: ${entitiesQuery}`);
    
    const entitiesResult = await falkorDBService.roQuery(entitiesQuery);
    console.log(`[Graph API] Entidades encontradas: ${entitiesResult.rows.length}`);

    // Buscar relaciones entre entidades del documento
    const relationsQuery = `MATCH (a)-[r]->(b) WHERE a.documentId = "${id}" AND b.documentId = "${id}" RETURN a.name AS source, type(r) AS type, b.name AS target, a.id AS sourceId, b.id AS targetId`;
    console.log(`[Graph API] Ejecutando consulta relaciones: ${relationsQuery}`);

    const relationsResult = await falkorDBService.roQuery(relationsQuery);
    console.log(`[Graph API] Relaciones encontradas: ${relationsResult.rows.length}`);

    const entities = entitiesResult.rows.map(row => ({
      id: row.id || row.docId || 'unknown',
      type: row.type || 'UNKNOWN',
      name: row.name || 'Unknown',
      description: row.description || '',
    }));

    const relations = relationsResult.rows.map(row => ({
      source: row.source,
      type: row.type || 'RELATED_TO',
      target: row.target,
      sourceId: row.sourceId,
      targetId: row.targetId,
    }));

    console.log(`[Graph API] Devolviendo ${entities.length} entidades y ${relations.length} relaciones`);

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        status: document.status,
      },
      entities,
      relations,
      stats: {
        entityCount: entities.length,
        relationCount: relations.length,
        documentInGraph: entities.length > 0,
      },
    });
  } catch (error: any) {
    console.error("Error getting document graph:", error);
    console.error("Stack trace:", error.stack);
    return NextResponse.json(
      {
        success: false,
        error: "Error al obtener grafo del documento",
        details: error.message,
        entities: [],
        relations: [],
        stats: { entityCount: 0, relationCount: 0, documentInGraph: false },
      },
      { status: 500 }
    );
  }
}
