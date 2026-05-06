import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

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

    // Access control
    const userRole = (session.user as any).role as string;
    if (userRole === "COMPANY" && ticket.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (userRole === "ASSESSOR") {
      const company = await prisma.user.findUnique({
        where: { id: ticket.userId },
        select: { assessorId: true },
      });
      if (company?.assessorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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
    // If so, move the cert back to IN_REVIEW and notify the assessor to re-evaluate.
    if (status === "CLOSED" && ticket.companyCertificationId) {
      const openCount = await prisma.capaTicket.count({
        where: {
          companyCertificationId: ticket.companyCertificationId,
          status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] },
          id: { not: id },
        },
      });
      if (openCount === 0) {
        const cert = await prisma.companyCertification.update({
          where: { id: ticket.companyCertificationId },
          data: { status: "IN_REVIEW" },
          select: { companyId: true },
        });

        // Notificar al assessor asignado para que retome la revisión
        const company = await prisma.user.findUnique({
          where: { id: cert.companyId },
          select: { assessorId: true, companyName: true, name: true },
        });
        if (company?.assessorId) {
          await notify({
            userId: company.assessorId,
            type: "CAPA_RESOLVED",
            title: "Tickets CAPA resueltos — re-evaluación pendiente",
            body: `${company.companyName || company.name || "La empresa"} ha cerrado todos los tickets CAPA y está lista para ser re-evaluada.`,
            link: "/dashboard/queue",
          });
        }
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
