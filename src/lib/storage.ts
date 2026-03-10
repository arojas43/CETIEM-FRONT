import { Storage, Bucket } from "@google-cloud/storage";
import { localStorageService } from "./local-storage";

/**
 * Servicio de almacenamiento unificado
 * Usa Google Cloud Storage en producción o almacenamiento local en desarrollo
 */
export class StorageService {
  private storage?: Storage;
  private bucketName?: string;
  private bucket?: Bucket;
  private useLocal: boolean;

  constructor() {
    // Usar almacenamiento local si no hay credenciales de GCS
    this.useLocal = !process.env.GOOGLE_CLOUD_PROJECT_ID || 
                    !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
                    process.env.NODE_ENV === "development";
  }

  /**
   * Obtiene el bucket de almacenamiento (solo producción)
   */
  async getBucket(): Promise<Bucket> {
    if (this.useLocal) {
      throw new Error("Bucket storage not available in local mode");
    }

    if (!this.bucket) {
      if (!this.storage) {
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
      }
      
      this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "certificacion-documents";
      
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      
      if (!exists) {
        await this.storage.createBucket(this.bucketName);
      }
      
      this.bucket = this.storage.bucket(this.bucketName);
    }
    
    return this.bucket;
  }

  /**
   * Sube un archivo
   * @param file - Buffer del archivo
   * @param filename - Nombre del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns URL de almacenamiento
   */
  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string; publicUrl: string; path?: string }> {
    if (this.useLocal) {
      const result = await localStorageService.saveFile(file, filename, mimeType);
      return {
        url: result.url,
        publicUrl: result.url,
        path: result.path,
      };
    }

    const bucket = await this.getBucket();
    const destination = `documents/${new Date().toISOString().split('T')[0]}/${filename}`;

    await bucket.file(destination).save(file, {
      contentType: mimeType,
      metadata: {
        metadata: {
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destination}`;

    return {
      url: `gs://${this.bucketName}/${destination}`,
      publicUrl,
    };
  }

  /**
   * Descarga un archivo
   * @param storageUrl - URL de almacenamiento o ruta local
   * @returns Buffer del archivo
   */
  async downloadFile(storageUrl: string): Promise<Buffer> {
    if (this.useLocal) {
      // Para local, necesitamos extraer documentId y filename de la URL
      // Formato: /api/files/{documentId}/{filename}
      const parts = storageUrl.split("/");
      if (parts.length >= 3) {
        const documentId = parts[parts.length - 2];
        const filename = parts[parts.length - 1];
        return localStorageService.getFile(documentId, filename);
      }
      throw new Error("Invalid local storage URL");
    }

    const path = storageUrl.replace('gs://', '');
    const [file] = await this.storage!.bucket(this.bucketName!).file(path).download();
    return file;
  }

  /**
   * Elimina un archivo
   * @param storageUrl - URL de almacenamiento o ruta local
   */
  async deleteFile(storageUrl: string, documentId?: string): Promise<void> {
    if (this.useLocal) {
      if (documentId) {
        await localStorageService.deleteFile(documentId);
      }
      return;
    }

    const path = storageUrl.replace('gs://', '');
    await this.storage!.bucket(this.bucketName!).file(path).delete();
  }

  /**
   * Genera una URL firmada para acceso temporal (solo producción)
   */
  async getSignedUrl(storageUrl: string, expires: number = 3600): Promise<string> {
    if (this.useLocal) {
      return storageUrl; // En local no necesitamos URLs firmadas
    }

    const path = storageUrl.replace('gs://', '');
    const [url] = await this.storage!
      .bucket(this.bucketName!)
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + expires * 1000,
      });
    return url;
  }

  /**
   * Lista archivos (solo producción)
   */
  async listFiles(prefix?: string): Promise<{ name: string; size: number; updatedAt: Date }[]> {
    if (this.useLocal) {
      const docs = await localStorageService.listDocuments();
      return docs.map(doc => ({
        name: doc.originalFilename,
        size: doc.size,
        updatedAt: new Date(doc.uploadedAt),
      }));
    }

    const bucket = await this.getBucket();
    const [files] = await bucket.getFiles({ prefix });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size ? parseInt(file.metadata.size as string) : 0,
      updatedAt: file.metadata.updated ? new Date(file.metadata.updated as string) : new Date(),
    }));
  }

  /**
   * Verifica si está usando almacenamiento local
   */
  isLocalMode(): boolean {
    return this.useLocal;
  }
}

export const storageService = new StorageService();
