import { prisma } from "@/lib/db";

interface AuditParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload || {},
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    // Audit log failures should never crash the main flow
    console.error("[AuditLog] Failed to write:", err);
  }
}
