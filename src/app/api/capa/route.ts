import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/capa — list CAPA tickets for current user (or all if admin/assessor) */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role as string;

    const where = role === "COMPANY" ? { userId: session.user.id } : {};

    const tickets = await prisma.capaTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        document: { select: { id: true, name: true } },
        finding:  { select: { id: true, type: true, severity: true, title: true } },
        user:     { select: { name: true, email: true, companyName: true } },
      },
    });

    // Auto-mark overdue
    const now = new Date();
    const overdueIds = tickets.filter(t => t.status === "OPEN" && t.dueDate < now).map(t => t.id);
    if (overdueIds.length > 0) {
      await prisma.capaTicket.updateMany({ where: { id: { in: overdueIds } }, data: { status: "OVERDUE" } });
      for (const t of tickets) {
        if (overdueIds.includes(t.id)) t.status = "OVERDUE";
      }
    }

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("GET capa error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
