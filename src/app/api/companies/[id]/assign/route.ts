import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

/** PATCH /api/companies/[id]/assign — assign/unassign assessor to company */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role as string;
    if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const { assessorId } = await req.json();

    // Capture previous assessor before overwriting
    const previous = await prisma.user.findUnique({
      where: { id },
      select: { assessorId: true, companyName: true, name: true },
    });

    const updated = await prisma.user.update({
      where: { id },
      data: { assessorId: assessorId || null },
    });

    await logAudit({
      userId: session.user.id,
      action: "ASSESSOR_ASSIGNED",
      entityType: "User",
      entityId: id,
      payload: { assessorId: assessorId || null },
    });

    const companyLabel = previous?.companyName || previous?.name || "Una empresa";

    // Notify the newly assigned assessor
    if (assessorId && assessorId !== previous?.assessorId) {
      await notify({
        userId: assessorId,
        type: "ASSESSOR_ASSIGNED",
        title: "Nueva empresa asignada",
        body: `${companyLabel} ha sido asignada a tu cartera. Revisa sus documentos en la cola de revisión.`,
        link: "/dashboard/queue",
      });
    }

    // Notify previous assessor if they were removed/replaced
    if (previous?.assessorId && previous.assessorId !== assessorId) {
      await notify({
        userId: previous.assessorId,
        type: "ASSESSOR_REMOVED",
        title: "Empresa reasignada",
        body: `${companyLabel} ha sido reasignada a otro assessor y ya no aparece en tu cartera.`,
        link: "/dashboard/queue",
      });
    }

    // Notify company about their assessor assignment
    if (assessorId) {
      const assessor = await prisma.user.findUnique({ where: { id: assessorId }, select: { name: true, email: true } });
      await notify({
        userId: id,
        type: "ASSESSOR_ASSIGNED",
        title: "Assessor ESG asignado",
        body: `${assessor?.name || assessor?.email || "Un assessor"} ha sido asignado para acompañar tu proceso de certificación ESG.`,
        link: "/dashboard",
      });
    }

    return NextResponse.json({ id: updated.id, assessorId: updated.assessorId });
  } catch (err) {
    console.error("assign assessor error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
