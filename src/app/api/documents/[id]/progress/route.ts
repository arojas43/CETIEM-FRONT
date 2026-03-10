import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/documents/[id]/progress
 * Obtiene el progreso de procesamiento de un documento
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

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        processingProgress: true,
        pageIndices: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calcular progreso estimado
    const progress = calculateProgress(document);

    return NextResponse.json({
      success: true,
      documentId: id,
      status: document.status,
      progress,
      details: document.processingProgress,
    });
  } catch (error: any) {
    console.error("Error getting progress:", error);
    return NextResponse.json(
      { error: "Error al obtener progreso", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[id]/progress
 * Actualiza el progreso de procesamiento de un documento
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const { step, percentage, details } = body;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Actualizar progreso
    await prisma.document.update({
      where: { id },
      data: {
        processingProgress: {
          step,
          percentage,
          details,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Progreso actualizado",
    });
  } catch (error: any) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: "Error al actualizar progreso", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Calcula el progreso basado en el estado y los índices
 */
function calculateProgress(document: any) {
  const { status, pageIndices, processingProgress } = document;

  // Progreso por defecto según el estado
  const defaultProgress: Record<string, { percentage: number; step: string }> = {
    PENDING: { percentage: 0, step: "En cola" },
    PROCESSING: { percentage: 10, step: "Iniciando" },
    INDEXED: { percentage: 50, step: "Índice completado" },
    ANALYZED: { percentage: 100, step: "Completado" },
    FAILED: { percentage: 0, step: "Error" },
  };

  // Si hay progreso guardado, usarlo
  if (processingProgress) {
    return {
      percentage: processingProgress.percentage || 0,
      step: processingProgress.step || "Procesando",
      details: processingProgress.details || {},
    };
  }

  // Si no, calcular basado en el estado
  const defaultProg = defaultProgress[status] || { percentage: 0, step: "Desconocido" };

  // Ajustar basado en número de índices (PageIndex)
  if (status === "INDEXED" && pageIndices) {
    const indexCount = pageIndices.length;
    const bonus = Math.min(indexCount / 100, 0.2); // Hasta 20% extra por muchos índices
    return {
      percentage: Math.min(defaultProg.percentage + bonus * 100, 99),
      step: defaultProg.step,
      details: {
        pageIndices: indexCount,
      },
    };
  }

  return {
    percentage: defaultProg.percentage,
    step: defaultProg.step,
    details: {},
  };
}
