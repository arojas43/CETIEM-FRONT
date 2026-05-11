import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { DashboardView } from './dashboard-view'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const userId = session.user.id!
  const role   = (session.user.role as string | undefined)?.toLowerCase() ?? 'company'
  const isCompany         = role === 'company'
  const isAdminOrAssessor = !isCompany
  const isAssessor        = role === 'assessor'

  const assessorUserFilter = isAssessor ? { assessorId: userId } : {}
  const assessorDocFilter  = isAssessor ? { user: { assessorId: userId } } : {}
  const assessorCapaFilter = isAssessor ? { user: { assessorId: userId } } : {}
  const assessorCertFilter = isAssessor ? { company: { assessorId: userId } } : {}

  // Todas las queries en paralelo — sin awaits secuenciales
  const [
    total, processing, indexed, analyzed, failed, recentDocs,
    companyUser, cert, capaCount,
    allUsers, allDocsGlobal,
    globalTotal, globalProcessing, globalAnalyzed, globalFailed,
    globalUsers, globalApproved, globalCapa,
  ] = await Promise.all([
    // Doc counts (todos los roles)
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

    // Company-specific (null para otros roles)
    isCompany
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { track: true, sprintLevel: true, companyName: true, assessor: { select: { name: true, email: true } } },
        })
      : Promise.resolve(null),
    isCompany
      ? prisma.companyCertification.findFirst({
          where: { companyId: userId },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, esgScore: true, requirements: true, publicToken: true },
        })
      : Promise.resolve(null),
    isCompany
      ? prisma.capaTicket.count({ where: { userId, status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] } } })
      : Promise.resolve(0),

    // Admin/Assessor lists (vacíos para company)
    isAdminOrAssessor
      ? prisma.user.findMany({
          where: { role: 'COMPANY', ...assessorUserFilter },
          select: {
            id: true, name: true, email: true, companyName: true, createdAt: true,
            _count: { select: { documents: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
    isAdminOrAssessor
      ? prisma.document.findMany({
          where: assessorDocFilter,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true, name: true, status: true, createdAt: true, domain: true, userId: true,
            user: { select: { id: true, name: true, email: true, companyName: true } },
            certifications: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } },
          },
        })
      : Promise.resolve([]),

    // Admin/Assessor global counts (0 para company)
    isAdminOrAssessor ? prisma.document.count({ where: assessorDocFilter }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.document.count({ where: { ...assessorDocFilter, status: 'PROCESSING' } }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.document.count({ where: { ...assessorDocFilter, status: 'ANALYZED' } }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.document.count({ where: { ...assessorDocFilter, status: 'FAILED' } }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.user.count({ where: { role: 'COMPANY', ...assessorUserFilter } }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.companyCertification.count({ where: { status: 'APPROVED', ...assessorCertFilter } }) : Promise.resolve(0),
    isAdminOrAssessor ? prisma.capaTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'OVERDUE'] }, ...assessorCapaFilter } }) : Promise.resolve(0),
  ])

  const certStats = isCompany && cert !== null
    ? {
        total:      1,
        approved:   cert.status === 'APPROVED' ? 1 : 0,
        rejected:   cert.status === 'REJECTED' ? 1 : 0,
        capaOpen:   capaCount,
        esgScore:   cert.esgScore ?? null,
        certStatus: cert.status ?? null,
        certId:     cert.id ?? null,
        certNotes:  (cert.requirements as any)?.notes ?? null,
        certFindings: (cert.requirements as any)?.findings ?? [],
        certVerdict:  (cert.requirements as any)?.verdict ?? null,
        publicToken:  cert.publicToken ?? null,
        assessedAt:   (cert.requirements as any)?.assessedAt ?? null,
      }
    : isCompany
      ? { total: 0, approved: 0, rejected: 0, capaOpen: capaCount, esgScore: null, certStatus: null,
          certId: null, certNotes: null, certFindings: [], certVerdict: null, publicToken: null, assessedAt: null }
      : null

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
