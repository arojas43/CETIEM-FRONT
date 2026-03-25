import { NextResponse } from "next/server";
import { falkorDBService, checkFalkorDBHealth } from "@/lib/falkordb";

/**
 * GET /api/graph/stats
 * Global graph statistics for the admin/assessor graph console
 */
export async function GET() {
  try {
    const isHealthy = await checkFalkorDBHealth();

    if (!isHealthy) {
      return NextResponse.json({
        connected: false,
        totalEntities: 0,
        totalRelations: 0,
        entityTypes: [],
        relationTypes: [],
        documentsInGraph: 0,
        status: "disconnected",
        message: "FalkorDB no está disponible.",
      });
    }

    const stats = await falkorDBService.getStats();

    return NextResponse.json({
      status: "connected",
      ...stats,
      connected: true,
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
