import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies
 * Paginated list of companies with their latest cert and docs summary.
 * Query params: page, limit (default 20), search
 * Access: ASSESSOR, ADMIN
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role as string;
  if (!["ASSESSOR", "ADMIN"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const search = searchParams.get("search") || "";
  const skip   = (page - 1) * limit;

  const where: any = { role: "COMPANY" };
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { email:       { contains: search, mode: "insensitive" } },
      { name:        { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, createdAt: true,
        companyName: true, track: true, sprintLevel: true, assessorId: true,
        documents: {
          select: {
            id: true, name: true, status: true, domain: true, createdAt: true,
            certifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, status: true, esgScore: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        companyCertifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, esgScore: true, createdAt: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return NextResponse.json({
    data: users,
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages, hasPrev: page > 1 },
  });
}
