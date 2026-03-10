import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storageService } from "@/lib/storage";

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
