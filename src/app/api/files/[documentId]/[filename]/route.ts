import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/[documentId]/[filename]
 * Sirve archivos almacenados localmente — requiere sesión válida.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; filename: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem;color:#555">
          <h3>Sesión requerida</h3>
          <p>Inicia sesión para ver este archivo.</p>
        </body></html>`,
        { status: 401, headers: { "Content-Type": "text/html" } }
      );
    }

    const { documentId, filename } = await params;
    const safeFilename = path.basename(filename); // prevent path traversal
    const role = (session.user as any).role as string;

    // ── Access control ──────────────────────────────────────────────────────
    if (role === "COMPANY") {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { userId: true },
      });
      if (!doc || doc.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "ASSESSOR") {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { user: { select: { assessorId: true } } },
      });
      if (!doc || doc.user.assessorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // ADMIN: access all

    // ── Resolve file path ────────────────────────────────────────────────────
    const basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
    const filePath = path.join(basePath, documentId, safeFilename);

    // Prevent traversal outside base path
    if (!filePath.startsWith(path.resolve(basePath))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem;color:#555">
          <h3>Archivo no encontrado</h3>
          <p>El PDF no está disponible en el servidor.</p>
        </body></html>`,
        { status: 404, headers: { "Content-Type": "text/html" } }
      );
    }

    // ── Read and serve ────────────────────────────────────────────────────────
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(safeFilename).toLowerCase();

    const contentTypes: Record<string, string> = {
      ".pdf":  "application/pdf",
      ".png":  "image/png",
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif":  "image/gif",
      ".svg":  "image/svg+xml",
      ".txt":  "text/plain",
      ".json": "application/json",
    };

    const contentType = contentTypes[ext] ?? "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Content-Length":      fileBuffer.byteLength.toString(),
        "Accept-Ranges":       "bytes",
        "Cache-Control":       "private, max-age=3600",
        // Allow embedding in same-origin iframes
        "X-Frame-Options":     "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
