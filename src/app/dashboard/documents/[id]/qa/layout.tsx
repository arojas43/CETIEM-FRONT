import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function QALayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as any).role as string;
  if (role === "COMPANY") {
    const { id } = await params;
    redirect(`/dashboard/documents/${id}`);
  }
  return <>{children}</>;
}
