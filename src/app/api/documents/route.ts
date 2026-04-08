import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { documentProcessingQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    hasPrev: boolean;
  };
}

/**
 * GET /api/documents
 * Obtiene los documentos del usuario autenticado con paginación
 * Query params: page, limit, status, search
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string;
    const isCompany = role === "COMPANY";

    // Parsear parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Validar parámetros
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    // Empresa: solo sus docs. Assessor: solo docs de empresas asignadas. Admin: todos.
    const where: any = isCompany
      ? { userId: session.user.id }
      : role === "ASSESSOR"
        ? { user: { assessorId: session.user.id } }
        : {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Obtener total para paginación
    const total = await prisma.document.count({ where });
    const totalPages = Math.ceil(total / validLimit);

    // Obtener documentos paginados
    const documents = await prisma.document.findMany({
      where,
      include: {
        certifications: true,
        pageIndices: { orderBy: { level: "asc" }, take: 5 },
        user: !isCompany
          ? { select: { id: true, companyName: true, name: true, email: true } }
          : false,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: validLimit,
    });

    const response: PaginatedResponse<any> = {
      data: documents,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages,
        hasMore: validPage < totalPages,
        hasPrev: validPage > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { 
        error: "Error al obtener documentos",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents
 * Crea un nuevo documento y lo guarda
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const description = formData.get("description") as string;
    const tipoDocumento = (formData.get("tipoDocumento") as string) || null;
    const categoriaDoc = (formData.get("categoriaDoc") as string) || "OTRO";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validar tipo de archivo
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Convertir a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute SHA-256 hash for forensic integrity
    const { createHash } = await import("crypto");
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // Primero crear registro en BD para obtener el ID
    const document = await prisma.document.create({
      data: {
        name: file.name,
        description: description || null,
        mimeType: file.type,
        size: file.size,
        storageUrl: "/pending", // Temporal, se actualiza después
        status: "PENDING",
        sha256,
        tipoDocumento: tipoDocumento || null,
        categoriaDoc: (categoriaDoc as any) || "OTRO",
        userId: session.user.id,
      },
    });

    // Guardar archivo usando el ID de la BD
    const { localStorageService } = await import('@/lib/local-storage');
    const result = await localStorageService.saveFileWithId(
      buffer,
      file.name,
      file.type,
      document.id
    );

    // Actualizar documento con la URL
    await prisma.document.update({
      where: { id: document.id },
      data: { storageUrl: result.url },
    });

    // Audit log
    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      userId: session.user.id,
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: document.id,
      payload: { name: file.name, size: file.size, sha256 },
    });

    // Encolar trabajo de procesamiento (opcional, si Redis está disponible)
    try {
      await documentProcessingQueue.add("document-processing", {
        documentId: document.id,
        userId: session.user.id,
        type: "index",
      });
      console.log(`[Upload] Trabajo encolado para documento ${document.id}`);
    } catch (queueError) {
      console.warn('[Upload] Redis no disponible, procesamiento manual requerido:', queueError);
      // Actualizar estado para indicar que necesita procesamiento manual
      await prisma.document.update({
        where: { id: document.id },
        data: { status: "PENDING" },
      });
    }

    return NextResponse.json({
      ...document,
      publicUrl: result.url,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
