import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DashboardView } from './dashboard-view'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const userId = session.user.id!
  const role   = (session.user.role as string | undefined)?.toLowerCase() ?? 'company'

  const [total, processing, indexed, analyzed, failed, recentDocs] = await Promise.all([
    prisma.document.count({ where: { userId } }),
    prisma.document.count({ where: { userId, status: 'PROCESSING' } }),
    prisma.document.count({ where: { userId, status: 'INDEXED' } }),
    prisma.document.count({ where: { userId, status: 'ANALYZED' } }),
    prisma.document.count({ where: { userId, status: 'FAILED' } }),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, name: true, status: true, createdAt: true, domain: true,
        certifications: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, esgScore: true } },
      },
    }),
  ])

  // Company-specific: cert stats and sprint/track
  const companyUser = role === 'company'
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { track: true, sprintLevel: true, companyName: true },
      })
    : null

  const certStats = role === 'company'
    ? await prisma.certification.aggregate({
        where: { document: { userId } },
        _count: true,
      }).then(async r => ({
        total: r._count,
        approved: await prisma.certification.count({ where: { document: { userId }, status: 'APPROVED' } }),
        rejected: await prisma.certification.count({ where: { document: { userId }, status: 'REJECTED' } }),
        capaOpen: await prisma.capaTicket.count({ where: { userId, status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } } }),
      }))
    : null

  // Assessor/Admin global stats
  const allUsers = await prisma.user.findMany({
    where: { role: 'COMPANY' },
    select: {
      id: true, name: true, email: true, companyName: true, createdAt: true,
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const allDocsGlobal = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true, name: true, status: true, createdAt: true, domain: true,
      user: { select: { name: true, email: true, companyName: true } },
      certifications: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
    },
  })

  const [globalTotal, globalProcessing, globalAnalyzed, globalFailed, globalUsers,
         globalApproved, globalCapa] =
    await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: 'PROCESSING' } }),
      prisma.document.count({ where: { status: 'ANALYZED' } }),
      prisma.document.count({ where: { status: 'FAILED' } }),
      prisma.user.count({ where: { role: 'COMPANY' } }),
      prisma.certification.count({ where: { status: 'APPROVED' } }),
      prisma.capaTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } } }),
    ])

  return (
    <DashboardView
      userName={session.user.name || session.user.email || 'Usuario'}
      stats={{ total, processing, indexed, analyzed, failed }}
      recentDocs={recentDocs.map(d => ({ ...d, certStatus: d.certifications[0]?.status, esgScore: d.certifications[0]?.esgScore }))}
      globalStats={{ total: globalTotal, processing: globalProcessing, analyzed: globalAnalyzed, failed: globalFailed, users: globalUsers, approved: globalApproved, capaOpen: globalCapa }}
      allUsers={allUsers}
      allDocsGlobal={allDocsGlobal}
      companyMeta={companyUser}
      certStats={certStats}
    />
  )
}
