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

    // Notify company about assessor assignment
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
