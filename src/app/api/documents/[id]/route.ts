import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storageService } from "@/lib/storage";
import { canAccessDocument } from "@/lib/access";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/[id]
 * Devuelve los datos de un documento (accesible por el dueño o cualquier usuario autenticado para la consola de revisión)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true, status: true,
        domain: true, size: true, mimeType: true, storageUrl: true,
        createdAt: true, updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Re-fetch userId for access check (not in select above)
    const docOwner = await prisma.document.findUnique({ where: { id }, select: { userId: true } });
    if (!docOwner || !(await canAccessDocument(docOwner.userId, session))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]
 * Elimina un documento
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar que el documento pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Eliminar archivo del almacenamiento
    try {
      await storageService.deleteFile(document.storageUrl, id);
    } catch (storageError) {
      console.warn("Error eliminando archivo:", storageError);
    }

    // Eliminar registro de la BD (en cascada elimina pageIndices y certifications)
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Documento eliminado correctamente" 
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Actualiza un documento
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar que el documento pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Campos permitidos para actualizar
    const { description, name } = body;

    const updateData: any = {};
    if (description !== undefined) updateData.description = description;
    if (name !== undefined) updateData.name = name;

    // Actualizar documento
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
