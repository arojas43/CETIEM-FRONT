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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, filename } = await params;
    const safeFilename = path.basename(filename); // prevent path traversal
    const role = (session.user as any).role as string;

    // Access control: COMPANY can only access their own documents
    if (role === "COMPANY") {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { userId: true },
      });
      if (!doc || doc.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (role === "ASSESSOR") {
      // ASSESSOR can only access files from their assigned companies
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { user: { select: { assessorId: true } } },
      });
      if (!doc || doc.user.assessorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // ADMIN: access all

    const basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
    const filePath = path.join(basePath, documentId, safeFilename);

    // Prevent traversal outside base path
    if (!filePath.startsWith(path.resolve(basePath))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // Determinar Content-Type
    const contentTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".txt": "text/plain",
      ".json": "application/json",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
