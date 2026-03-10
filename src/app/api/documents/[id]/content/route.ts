import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { PaginatedResponse } from "@/app/api/documents/route";

export interface SectionData {
  id: string;
  level: number;
  title: string;
  page: number | null;
  content: string | null;
  summary: string | null;
  hasChildren: boolean;
  childrenCount: number;
}

/**
 * GET /api/documents/[id]/content
 * Obtiene el contenido extraído de un documento con paginación
 * Query params: page, limit, level, search
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

    // Parsear parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const level = searchParams.get("level");
    const search = searchParams.get("search");

    // Validar parámetros
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    // Obtener documento
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        userId: true,
        createdAt: true,
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

    // Construir filtro where para índices
    const whereIndex: any = { documentId: id };

    if (level) {
      whereIndex.level = parseInt(level);
    }

    if (search) {
      whereIndex.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Obtener total para paginación
    const total = await prisma.pageIndex.count({ where: whereIndex });
    const totalPages = Math.ceil(total / validLimit);

    // Obtener índices paginados
    const indices = await prisma.pageIndex.findMany({
      where: whereIndex,
      orderBy: [
        { level: "asc" },
        { page: "asc" },
      ],
      skip,
      take: validLimit,
      include: {
        children: {
          select: { id: true },
        },
        parent: {
          select: { id: true, title: true },
        },
      },
    });

    // Transformar a formato de sección
    const sections: SectionData[] = indices.map(index => ({
      id: index.id,
      level: index.level,
      title: index.title,
      page: index.page,
      content: index.content,
      summary: index.metadata && typeof index.metadata === 'object' && 'summary' in index.metadata
        ? (index.metadata as any).summary
        : null,
      hasChildren: index.children.length > 0,
      childrenCount: index.children.length,
    }));

    const response: PaginatedResponse<SectionData> = {
      data: sections,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasMore: validPage < totalPages,
        hasPrev: validPage > 1,
      },
    };

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        status: document.status,
        totalSections: document._count.pageIndices,
      },
      ...response,
    });
  } catch (error: any) {
    console.error("Error getting document content:", error);
    return NextResponse.json(
      { 
        error: "Error al obtener contenido del documento",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
