import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { RoleProvider } from '@/lib/role-context'
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
      <div className="dark flex h-screen bg-cetiem-dark text-white overflow-hidden">
        <Sidebar userName={session.user.name} userEmail={session.user.email} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </RoleProvider>
  )
}
