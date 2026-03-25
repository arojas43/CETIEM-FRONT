import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processDocument } from "@/lib/process-document-service";

export type DocumentDomainType = 'INDUSTRIA' | 'CONSTRUCCION' | 'TECNOLOGIA';

/**
 * POST /api/documents/[id]/process
 * Procesa manualmente un documento con el dominio especificado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const { domain, extractionConfig } = body || {};

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar que el documento existe y pertenece al usuario
    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, name: true, status: true, domain: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validar dominio
    const validDomains: DocumentDomainType[] = ['INDUSTRIA', 'CONSTRUCCION', 'TECNOLOGIA'];
    const selectedDomain = (domain?.toUpperCase() || document.domain || 'INDUSTRIA') as string;

    if (!validDomains.includes(selectedDomain as DocumentDomainType)) {
      return NextResponse.json(
        { error: `Dominio inválido. Debe ser uno de: ${validDomains.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Process API] Procesando documento ${id} con dominio ${selectedDomain}`);

    // Actualizar estado a PROCESSING
    await prisma.document.update({
      where: { id },
      data: { 
        status: 'PROCESSING',
        domain: selectedDomain as any,
      },
    });

    // Ejecutar procesamiento (sin await para no bloquear la respuesta)
    // Pero esperamos a que termine para dar feedback al usuario
    try {
      const domainLower = selectedDomain.toLowerCase() as 'industria' | 'construccion' | 'tecnologia';
      const result = await processDocument(id, domainLower, extractionConfig ?? undefined);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "Documento procesado exitosamente",
          document: {
            id: result.documentId,
            status: result.status,
            entities: result.entities,
            indices: result.indices,
            duration: result.duration,
          },
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
            message: "Error al procesar documento",
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error('[Process API] Error en procesamiento:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Error desconocido al procesar",
          message: "Error al procesar documento",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing document:", error);
    return NextResponse.json(
      {
        error: "Error al procesar documento",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/documents/[id]/domain
 * Actualiza el dominio de un documento sin procesar
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const { domain } = body;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validDomains: DocumentDomainType[] = ['INDUSTRIA', 'CONSTRUCCION', 'TECNOLOGIA'];
    if (!domain || !validDomains.includes(domain.toUpperCase() as DocumentDomainType)) {
      return NextResponse.json(
        { error: `Dominio inválido. Debe ser uno de: ${validDomains.join(', ')}` },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true, domain: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const userRole = (session.user as any).role;
    const canAccessAll = userRole === "ASSESSOR" || userRole === "ADMIN";
    if (!canAccessAll && document.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.document.update({
      where: { id },
      data: { domain: domain.toUpperCase() },
    });

    return NextResponse.json({
      success: true,
      message: "Dominio actualizado correctamente",
      domain: domain.toUpperCase(),
    });
  } catch (error: any) {
    console.error("Error updating domain:", error);
    return NextResponse.json(
      { error: "Error al actualizar dominio", details: error.message },
      { status: 500 }
    );
  }
}
