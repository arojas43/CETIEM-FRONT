import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInPage } from "@/components/auth";

export default async function SignInPageWrapper() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return <SignInPage />;
}
