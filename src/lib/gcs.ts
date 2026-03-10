import { Storage, Bucket } from "@google-cloud/storage";

/**
 * Servicio de Google Cloud Storage para almacenamiento de documentos
 */
export class GCSService {
  private storage: Storage;
  private bucketName: string;
  private bucket?: Bucket;

  constructor() {
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "certificacion-documents";
  }

  /**
   * Obtiene el bucket de almacenamiento
   */
  async getBucket(): Promise<Bucket> {
    if (!this.bucket) {
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      
      if (!exists) {
        await this.storage.createBucket(this.bucketName);
      }
      
      this.bucket = this.storage.bucket(this.bucketName);
    }
    
    return this.bucket;
  }

  /**
   * Sube un archivo al bucket
   * @param file - Buffer del archivo
   * @param filename - Nombre del archivo
   * @param mimeType - Tipo MIME del archivo
   * @returns URL de almacenamiento
   */
  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string; publicUrl: string }> {
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
   * Descarga un archivo del bucket
   * @param storageUrl - URL de almacenamiento (gs://...)
   * @returns Buffer del archivo
   */
  async downloadFile(storageUrl: string): Promise<Buffer> {
    const path = storageUrl.replace('gs://', '');
    const [file] = await this.storage.bucket(this.bucketName).file(path).download();
    return file;
  }

  /**
   * Elimina un archivo del bucket
   * @param storageUrl - URL de almacenamiento
   */
  async deleteFile(storageUrl: string): Promise<void> {
    const path = storageUrl.replace('gs://', '');
    await this.storage.bucket(this.bucketName).file(path).delete();
  }

  /**
   * Genera una URL firmada para acceso temporal
   * @param storageUrl - URL de almacenamiento
   * @param expires - Tiempo de expiración en segundos
   * @returns URL firmada
   */
  async getSignedUrl(storageUrl: string, expires: number = 3600): Promise<string> {
    const path = storageUrl.replace('gs://', '');
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + expires * 1000,
      });
    return url;
  }

  /**
   * Lista archivos en un prefijo dado
   * @param prefix - Prefijo de búsqueda
   * @returns Lista de archivos
   */
  async listFiles(prefix?: string): Promise<{ name: string; size: number; updatedAt: Date }[]> {
    const [files] = await this.storage
      .bucket(this.bucketName)
      .getFiles({ prefix });

    return files.map(file => ({
      name: file.name,
      size: file.metadata.size ? parseInt(file.metadata.size as string) : 0,
      updatedAt: file.metadata.updated ? new Date(file.metadata.updated as string) : new Date(),
    }));
  }
}

export const gcsService = new GCSService();
