import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/assessors/list — list all assessors with their companies (ASSESSOR/ADMIN) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role as string;
  if (!["ASSESSOR", "ADMIN"].includes(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessors = await prisma.user.findMany({
    where: { role: "ASSESSOR" },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, createdAt: true,
      companies: {
        select: {
          id: true, companyName: true, name: true, email: true, track: true,
          documents: {
            select: { id: true, certifications: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json(assessors);
}
