/**
 * Tipos y constantes para procesamiento de documentos grandes (hasta 2GB)
 */

// Límites configurables
export const DOCUMENT_LIMITS = {
  // Tamaño máximo: 2GB
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB en bytes
  
  // Chunking de texto
  CHUNK_SIZE: 15000,  // Caracteres por chunk para LLM
  CHUNK_OVERLAP: 500, // Superposición entre chunks para contexto
  
  // Procesamiento por lotes
  BATCH_SIZE: 10,     // Entidades por lote
  MAX_BATCHES: 100,   // Máximo de lotes por documento
  
  // Memoria
  MAX_BUFFER_SIZE: 50 * 1024 * 1024, // 50MB máximo en memoria
  STREAM_THRESHOLD: 10 * 1024 * 1024, // Usar streaming si > 10MB
  
  // Tiempo - AUMENTADO para documentos médicos complejos
  TIMEOUT_PER_MB: 10000,     // 10 segundos por MB (antes 5s)
  MIN_TIMEOUT: 60000,        // 60 segundos mínimo (antes 30s)
  MAX_TIMEOUT: 600000,       // 10 minutos máximo por chunk (antes 10min)
  CHUNK_TIMEOUT: 300000,     // 5 minutos por chunk específico (NUEVO)
  
  // Reintentos
  MAX_RETRIES: 5,
  RETRY_DELAY: 3000,         // 3 segundos entre reintentos
  
  // Progreso
  PROGRESS_INTERVAL: 1000,   // Actualizar progreso cada 1 segundo
} as const;

// Tipos de documentos y sus límites específicos
export const DOCUMENT_TYPES = {
  PDF: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    maxPages: 10000,
  },
  TEXT: {
    extensions: ['.txt', '.md'],
    mimeTypes: ['text/plain', 'text/markdown'],
    maxSize: 100 * 1024 * 1024, // 100MB para texto
  },
} as const;

// Estados de procesamiento
export type ProcessingStatus = 
  | 'QUEUED'
  | 'STREAMING'
  | 'EXTRACTING'
  | 'CHUNKING'
  | 'ANALYZING'
  | 'PERSISTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED';

// Progreso del procesamiento
export interface ProcessingProgress {
  status: ProcessingStatus;
  percentage: number;
  currentStep: number;
  totalSteps: number;
  details: {
    pagesProcessed?: number;
    totalPages?: number;
    chunksProcessed?: number;
    totalChunks?: number;
    entitiesExtracted?: number;
    bytesProcessed?: number;
    totalBytes?: number;
    currentChunk?: number;
    errorMessage?: string;
  };
  estimatedTimeRemaining?: number; // en segundos
  startedAt: number;
  updatedAt: number;
}

// Chunk de texto para procesamiento
export interface TextChunk {
  id: string;
  index: number;
  content: string;
  startOffset: number;
  endOffset: number;
  metadata: {
    page?: number;
    section?: string;
    charCount: number;
  };
}

// Resultado de extracción
export interface ExtractionResult {
  text: string;
  pages: string[];
  totalPages: number;
  requiresOcr: boolean;
  ocrConfidence?: number;
  chunks: TextChunk[];
  metadata: {
    fileSize: number;
    processingTime: number;
    streamingUsed: boolean;
  };
}

// Configuración de procesamiento
export interface ProcessingConfig {
  documentId: string;
  documentName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  
  // Opciones
  useStreaming: boolean;
  enableOcr: boolean;
  ocrLanguage: string;
  
  // Límites
  maxChunks?: number;
  batchSize?: number;
  timeout?: number;
}

// Resultado de análisis de chunk
export interface ChunkAnalysis {
  chunkId: string;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    confidence: number;
  }>;
  relations: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    confidence: number;
  }>;
  processingTime: number;
  error?: string;
}

// Trabajo de procesamiento en cola
export interface LargeDocumentJob {
  id: string;
  documentId: string;
  userId: string;
  type: 'extract' | 'analyze' | 'persist';
  priority: 'low' | 'normal' | 'high';
  chunkIndex?: number;
  totalChunks?: number;
  retryCount: number;
  createdAt: number;
}
