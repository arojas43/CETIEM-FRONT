import { z } from "zod";

export const VALID_DOMAINS = ["INDUSTRIA", "CONSTRUCCION", "TECNOLOGIA"] as const;
export const VALID_DOMAINS_LOWER = ["industria", "construccion", "tecnologia"] as const;

const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_BYTES || String(50 * 1024 * 1024));
const SAFE_FILENAME = /^[\w.\-() ]{1,255}$/;

export const uploadFileSchema = z.object({
  size:     z.number().max(MAX_FILE_SIZE, `El archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB`),
  type:     z.literal("application/pdf", { errorMap: () => ({ message: "Solo se permiten archivos PDF" }) }),
  name:     z.string().regex(SAFE_FILENAME, "Nombre de archivo contiene caracteres no permitidos"),
});

export const extractionConfigSchema = z.object({
  mode:                z.enum(["auto", "directed", "mixed"]).default("auto"),
  focusTopics:         z.string().max(500).optional(),
  customEntityTypes:   z.string().max(1000).optional(),
  customRelationTypes: z.string().max(1000).optional(),
  instructions:        z.string().max(2000).optional(),
}).optional();

export const processSchema = z.object({
  domain:          z.enum(VALID_DOMAINS_LOWER).optional(),
  extractionConfig: extractionConfigSchema,
});

export const searchSchema = z.object({
  query:   z.string().min(1, "La consulta no puede estar vacía").max(500),
  page:    z.number().int().min(1).max(100).optional(),
  section: z.string().max(200).optional(),
});

export type UploadFileInput  = z.infer<typeof uploadFileSchema>;
export type ProcessInput     = z.infer<typeof processSchema>;
export type SearchInput      = z.infer<typeof searchSchema>;
