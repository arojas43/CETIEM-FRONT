import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Servicio de almacenamiento local para documentos
 * Usado en desarrollo en lugar de Google Cloud Storage
 */
export class LocalStorageService {
  private basePath: string;

  constructor() {
    this.basePath = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "uploads");
    this.ensureBasePath();
  }

  private ensureBasePath(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private getDocumentPath(documentId: string): string {
    const docPath = path.join(this.basePath, documentId);
    if (!fs.existsSync(docPath)) {
      fs.mkdirSync(docPath, { recursive: true });
    }
    return docPath;
  }

  /**
   * Guarda un archivo localmente
   * @param file - Buffer del archivo
   * @param filename - Nombre original del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns Ruta de almacenamiento y URL local
   */
  async saveFile(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ path: string; url: string; filename: string }> {
    const documentId = uuidv4();
    return this.saveFileWithId(file, filename, mimeType, documentId);
  }

  /**
   * Guarda un archivo con un ID específico (de la BD)
   * @param file - Buffer del archivo
   * @param filename - Nombre original del archivo
   * @param mimeType - Tipo MIME del archivo
   * @param documentId - ID del documento (de la BD)
   * @returns Ruta de almacenamiento y URL local
   */
  async saveFileWithId(
    file: Buffer,
    filename: string,
    mimeType: string,
    documentId: string
  ): Promise<{ path: string; url: string; filename: string }> {
    const ext = path.extname(filename);
    const storedFilename = `${documentId}${ext}`;
    const docPath = this.getDocumentPath(documentId);
    const fullPath = path.join(docPath, storedFilename);

    // Guardar archivo
    fs.writeFileSync(fullPath, file);

    // Guardar metadatos
    const metadata = {
      originalFilename: filename,
      mimeType,
      size: file.length,
      storedFilename,
      uploadedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(docPath, "metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    const url = `/api/files/${documentId}/${storedFilename}`;

    return {
      path: fullPath,
      url,
      filename: storedFilename,
    };
  }

  /**
   * Obtiene un archivo por ID de documento
   * @param documentId - ID del documento
   * @param filename - Nombre del archivo almacenado
   * @returns Buffer del archivo
   */
  async getFile(documentId: string, filename: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, documentId, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Obtiene los metadatos de un documento
   * @param documentId - ID del documento
   * @returns Metadatos del documento
   */
  async getMetadata(documentId: string): Promise<{
    originalFilename: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  } | null> {
    const metadataPath = path.join(this.basePath, documentId, "metadata.json");
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const content = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(content);
  }

  /**
   * Elimina un documento y sus archivos
   * @param documentId - ID del documento
   */
  async deleteFile(documentId: string): Promise<void> {
    const docPath = path.join(this.basePath, documentId);
    
    if (fs.existsSync(docPath)) {
      fs.rmSync(docPath, { recursive: true, force: true });
    }
  }

  /**
   * Lista todos los documentos almacenados
   * @returns Lista de documentos con sus metadatos
   */
  async listDocuments(): Promise<Array<{
    id: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>> {
    if (!fs.existsSync(this.basePath)) {
      return [];
    }

    const entries = fs.readdirSync(this.basePath);
    const documents: Array<{
      id: string;
      originalFilename: string;
      mimeType: string;
      size: number;
      uploadedAt: string;
    }> = [];

    for (const entry of entries) {
      const metadata = await this.getMetadata(entry);
      if (metadata) {
        documents.push({
          id: entry,
          ...metadata,
        });
      }
    }

    return documents;
  }
}

export const localStorageService = new LocalStorageService();
