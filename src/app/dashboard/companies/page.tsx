import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CompaniesView } from "./companies-view";

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, createdAt: true,
      documents: {
        select: { id: true, name: true, status: true, domain: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return <CompaniesView users={users} />;
}
