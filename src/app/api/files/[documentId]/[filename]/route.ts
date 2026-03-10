import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/files/[documentId]/[filename]
 * Sirve archivos almacenados localmente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; filename: string }> }
) {
  try {
    const { documentId, filename } = await params;
    
    const basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
    const filePath = path.join(basePath, documentId, filename);

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
