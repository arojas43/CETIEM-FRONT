import { z } from "zod";

export const idSchema = z.object({
  id: z.string().cuid("ID inválido"),
});

export const paginationSchema = z.object({
  page:   z.coerce.number().int().min(1).max(10_000).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(10),
  status: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
  sort:   z.enum(["asc", "desc"]).default("desc"),
});

export type IdParams   = z.infer<typeof idSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
