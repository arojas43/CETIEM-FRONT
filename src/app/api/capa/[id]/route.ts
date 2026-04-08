import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/** PATCH /api/capa/[id] — update CAPA ticket status/resolution */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { status, resolution } = await req.json();

    const ticket = await prisma.capaTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    // Companies can only update their own tickets
    const userRole = (session.user as any).role as string;
    if (userRole === "COMPANY" && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate state transitions
    if (status && status !== ticket.status) {
      const allowed: Record<string, string[]> = {
        OPEN:        ["IN_PROGRESS", "CLOSED"],
        IN_PROGRESS: ["CLOSED"],
        OVERDUE:     ["IN_PROGRESS", "CLOSED"],
        CLOSED:      [],
      };
      if (!allowed[ticket.status]?.includes(status)) {
        return NextResponse.json(
          { error: `Transición inválida: ${ticket.status} → ${status}` },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.capaTicket.update({
      where: { id },
      data: {
        status: status || ticket.status,
        resolution: resolution || ticket.resolution,
        closedAt: status === "CLOSED" ? new Date() : ticket.closedAt,
      },
    });

    // When a ticket is closed, check if ALL CAPAs for the certification are resolved.
    // If so, move the cert back to IN_REVIEW so the assessor can re-evaluate.
    if (status === "CLOSED" && ticket.companyCertificationId) {
      const openCount = await prisma.capaTicket.count({
        where: {
          companyCertificationId: ticket.companyCertificationId,
          status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
          id: { not: id },
        },
      });
      if (openCount === 0) {
        await prisma.companyCertification.update({
          where: { id: ticket.companyCertificationId },
          data: { status: "IN_REVIEW" },
        });
      }
    }

    await logAudit({
      userId: session.user.id,
      action: "CAPA_UPDATED",
      entityType: "CapaTicket",
      entityId: id,
      payload: { status, resolution },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH capa error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
