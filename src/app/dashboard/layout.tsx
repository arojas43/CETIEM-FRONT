import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RoleProvider } from '@/lib/role-context'
import { DashboardShell } from '@/components/dashboard-shell'
import type { UserRole } from '@/lib/role-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const sessionRole = (session.user.role?.toLowerCase() ?? "company") as UserRole;

  return (
    <RoleProvider defaultRole={sessionRole}>
      <DashboardShell userName={session.user.name} userEmail={session.user.email}>
        {children}
      </DashboardShell>
    </RoleProvider>
  )
}
