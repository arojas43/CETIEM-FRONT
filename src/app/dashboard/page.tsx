import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DashboardView } from './dashboard-view'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const userId = session.user.id!

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
      select: { id: true, name: true, status: true, createdAt: true, domain: true },
    }),
  ])

  const allUsers = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, createdAt: true,
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
      user: { select: { name: true, email: true } },
    },
  })

  const [globalTotal, globalProcessing, globalAnalyzed, globalFailed, globalUsers] =
    await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: 'PROCESSING' } }),
      prisma.document.count({ where: { status: 'ANALYZED' } }),
      prisma.document.count({ where: { status: 'FAILED' } }),
      prisma.user.count(),
    ])

  return (
    <DashboardView
      userName={session.user.name || session.user.email || 'Usuario'}
      stats={{ total, processing, indexed, analyzed, failed }}
      recentDocs={recentDocs}
      globalStats={{ total: globalTotal, processing: globalProcessing, analyzed: globalAnalyzed, failed: globalFailed, users: globalUsers }}
      allUsers={allUsers}
      allDocsGlobal={allDocsGlobal}
    />
  )
}
