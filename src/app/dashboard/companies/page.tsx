import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CompaniesView } from "./companies-view";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const [users, assessors] = await Promise.all([
    prisma.user.findMany({
      where: { role: "COMPANY" },
      orderBy: { createdAt: "desc" },
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
      },
    }),
    prisma.user.findMany({
      where: { role: "ASSESSOR" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return <CompaniesView users={users} assessors={assessors} />;
}
