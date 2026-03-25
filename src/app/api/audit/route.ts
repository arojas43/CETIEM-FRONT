import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET /api/audit — paginated audit log (admin only) */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any).role as string;
    if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip  = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);

    return NextResponse.json({ data: logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("GET audit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
