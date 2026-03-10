import { NextResponse } from "next/server";
import { falkorDBService, checkFalkorDBHealth } from "@/lib/falkordb";

/**
 * POST /api/graph/query
 * Consulta el grafo de conocimiento en FalkorDB
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Validar que no sea una consulta peligrosa
    const upperQuery = query.toUpperCase();
    const dangerousPatterns = ['DROP', 'DELETE ALL', 'DETACH DELETE ALL'];
    for (const pattern of dangerousPatterns) {
      if (upperQuery.includes(pattern)) {
        return NextResponse.json(
          { error: "Consulta no permitida: operaciones masivas de eliminación están restringidas" },
          { status: 403 }
        );
      }
    }

    // Verificar salud de FalkorDB
    const isHealthy = await checkFalkorDBHealth();
    if (!isHealthy) {
      return NextResponse.json(
        { 
          error: "FalkorDB no está disponible",
          details: "Verifica que el contenedor falkordb-dev esté corriendo (puerto 6380)",
          hint: "Ejecuta: docker ps | grep falkor"
        },
        { status: 503 }
      );
    }

    // Ejecutar consulta con el servicio mejorado
    const result = await falkorDBService.query(query);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error querying graph:", error);
    
    // Manejar errores específicos
    if (error.message.includes('Syntax error')) {
      return NextResponse.json(
        { error: "Error de sintaxis en la consulta Cypher", details: error.message },
        { status: 400 }
      );
    }
    
    if (error.message.includes('FalkorDB')) {
      return NextResponse.json(
        { error: "Error de conexión con FalkorDB", details: error.message },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Error al consultar el grafo", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/graph/stats
 * Obtiene estadísticas del grafo con verificación de salud
 */
export async function GET() {
  try {
    // Verificar salud primero
    const isHealthy = await checkFalkorDBHealth();
    
    if (!isHealthy) {
      return NextResponse.json({
        connected: false,
        entityCount: 0,
        relationCount: 0,
        entityTypes: [],
        relationTypes: [],
        documentsInGraph: 0,
        status: "disconnected",
        message: "FalkorDB no está disponible. Verifica que el contenedor esté corriendo.",
      });
    }

    // Obtener estadísticas con el servicio mejorado
    const stats = await falkorDBService.getStats();

    return NextResponse.json({
      status: "connected",
      ...stats,
    });
  } catch (error: any) {
    console.error("Error getting graph stats:", error);
    return NextResponse.json(
      { 
        error: "Error al obtener estadísticas del grafo",
        details: error.message,
        connected: false,
      },
      { status: 500 }
    );
  }
}
