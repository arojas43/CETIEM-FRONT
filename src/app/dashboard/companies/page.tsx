import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CompaniesView } from "./companies-view";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as any).role as string;
  if (!["ASSESSOR", "ADMIN"].includes(role)) redirect("/dashboard");

  // Only assessors list is fetched server-side — companies are paginated client-side via /api/companies
  const assessors = await prisma.user.findMany({
    where: { role: "ASSESSOR" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return <CompaniesView assessors={assessors} />;
}
