import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function GraphLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const userRole = (session.user as any).role;
  if (userRole !== "ASSESSOR" && userRole !== "ADMIN") redirect("/dashboard");
  return <>{children}</>;
}
