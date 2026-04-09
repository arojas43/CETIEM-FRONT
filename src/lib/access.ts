import { prisma } from "@/lib/db";

/**
 * Verifica si el usuario de la sesión puede acceder a un documento
 * dado el userId del propietario del documento.
 *
 * - ADMIN    → siempre
 * - ASSESSOR → solo si está asignado a la empresa dueña del documento
 * - COMPANY  → solo si es el propio dueño del documento
 */
export async function canAccessDocument(
  documentUserId: string,
  session: any
): Promise<boolean> {
  const role = (session.user as any).role as string;
  if (role === "ADMIN") return true;
  if (role === "COMPANY") return documentUserId === session.user.id;
  if (role === "ASSESSOR") {
    const owner = await prisma.user.findUnique({
      where: { id: documentUserId },
      select: { assessorId: true },
    });
    return owner?.assessorId === session.user.id;
  }
  return false;
}

/**
 * Verifica si el assessor está asignado a la empresa dada.
 * ADMIN siempre tiene acceso.
 */
export async function canAccessCompany(
  companyId: string,
  session: any
): Promise<boolean> {
  const role = (session.user as any).role as string;
  if (role === "ADMIN") return true;
  if (role === "COMPANY") return companyId === session.user.id;
  if (role === "ASSESSOR") {
    const company = await prisma.user.findUnique({
      where: { id: companyId, role: "COMPANY" },
      select: { assessorId: true },
    });
    return company?.assessorId === session.user.id;
  }
  return false;
}
