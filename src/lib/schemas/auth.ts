import { z } from "zod";

export const registerSchema = z.object({
  email:       z.string().email("Email inválido").max(254),
  password:    z.string().min(8, "Mínimo 8 caracteres").max(100),
  contactName: z.string().min(2).max(200),
  companyName: z.string().min(2).max(200),
  rfc:         z.string().max(13).optional(),
  industry:    z.string().max(100).optional(),
  phone:       z.string().max(20).optional(),
  track:       z.enum(["A", "B", "C"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
