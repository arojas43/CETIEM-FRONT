import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/documents/[id]/progress
 * Obtiene el progreso del procesamiento de un documento grande
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

    // Obtener documento
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        description: true,
        size: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { pageIndices: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calcular progreso basado en el estado y metadatos
    const progress = calculateProgress(document);

    return NextResponse.json({
      documentId: id,
      progress,
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
 * Calcula el progreso basado en el estado del documento
 */
function calculateProgress(document: any) {
  const status = document.status;
  const sizeMB = (document.size || 0) / (1024 * 1024);
  const sectionsCount = document._count?.pageIndices || 0;

  // Estados y su porcentaje base
  const statusProgress: Record<string, { percentage: number; label: string }> = {
    PENDING: { percentage: 5, label: 'En cola' },
    PROCESSING: { percentage: 20, label: 'Procesando' },
    INDEXED: { percentage: 60, label: 'Índice creado' },
    ANALYZED: { percentage: 100, label: 'Completado' },
    FAILED: { percentage: 0, label: 'Fallido' },
  };

  const baseProgress = statusProgress[status] || { percentage: 0, label: 'Desconocido' };

  // Ajustar porcentaje basado en tamaño (documentos grandes toman más tiempo)
  let adjustedPercentage = baseProgress.percentage;
  
  if (status === 'PROCESSING') {
    // Durante el procesamiento, estimar basado en secciones creadas
    const expectedSections = Math.ceil(sizeMB * 2); // ~2 secciones por MB
    const sectionProgress = Math.min(100, (sectionsCount / expectedSections) * 100);
    adjustedPercentage = 20 + (sectionProgress * 0.4); // 20% base + hasta 40% por secciones
  } else if (status === 'INDEXED') {
    // Durante el análisis, estimar basado en tiempo
    adjustedPercentage = 60 + (Math.min(40, sectionsCount * 0.5));
  }

  // Calcular tiempo estimado restante
  const now = Date.now();
  const createdAt = new Date(document.createdAt).getTime();
  const elapsed = now - createdAt;
  
  let estimatedRemaining = 0;
  if (adjustedPercentage > 0 && adjustedPercentage < 100) {
    const totalEstimated = elapsed / (adjustedPercentage / 100);
    estimatedRemaining = Math.max(0, totalEstimated - elapsed);
  }

  return {
    percentage: Math.round(adjustedPercentage),
    status,
    label: baseProgress.label,
    details: {
      sizeMB: sizeMB.toFixed(2),
      sections: sectionsCount,
      elapsedSeconds: Math.round(elapsed / 1000),
    },
    estimatedTimeRemaining: estimatedRemaining > 0 ? Math.round(estimatedRemaining / 1000) : null,
  };
}
