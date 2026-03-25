import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    return NextResponse.json({ id: updated.id, assessorId: updated.assessorId });
  } catch (err) {
    console.error("assign assessor error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
