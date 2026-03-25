import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { falkorDBService, checkFalkorDBHealth } from "@/lib/falkordb";

/**
 * POST /api/graph/query
 * Consulta el grafo de conocimiento en FalkorDB (solo ASSESSOR y ADMIN).
 * Ejecuta siempre como read-only (roQuery) para prevenir modificaciones.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ASSESSOR" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Allowlist: solo se permiten consultas de lectura
    const trimmed = query.trimStart().toUpperCase();
    const allowedPrefixes = ["MATCH", "WITH", "CALL", "RETURN", "UNWIND"];
    const isReadOnly = allowedPrefixes.some(p => trimmed.startsWith(p));
    if (!isReadOnly) {
      return NextResponse.json(
        { error: "Solo se permiten consultas de lectura (MATCH, WITH, CALL, RETURN, UNWIND)" },
        { status: 403 }
      );
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

    // roQuery garantiza read-only a nivel de BD (FalkorDB rechaza escrituras)
    const result = await falkorDBService.roQuery(query);

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
 * Obtiene estadísticas del grafo con verificación de salud (solo ASSESSOR y ADMIN).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRole = (session.user as any).role;
    if (userRole !== "ASSESSOR" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
