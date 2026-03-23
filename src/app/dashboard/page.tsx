import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { FileText, Upload, Search, Bell, MessageSquare } from 'lucide-react'
import Link from 'next/link'

// Simple SVG donut chart — no dependencies
function DonutChart({
  analyzed,
  processing,
  indexed,
  failed,
  total,
}: {
  analyzed: number
  processing: number
  indexed: number
  failed: number
  total: number
}) {
  const safeTotal = total || 1
  const r = 52
  const cx = 64
  const cy = 64
  const circumference = 2 * Math.PI * r

  const pctAnalyzed  = analyzed   / safeTotal
  const pctProgress  = processing / safeTotal
  const pctIndexed   = indexed    / safeTotal
  const pctFailed    = failed     / safeTotal

  type Segment = { pct: number; color: string; offset: number }
  const segments: Segment[] = []
  let offset = 0
  const data = [
    { pct: pctAnalyzed,  color: '#9fc031' },
    { pct: pctProgress,  color: '#ffbf00' },
    { pct: pctIndexed,   color: '#1e7d93' },
    { pct: pctFailed,    color: '#aa3939' },
  ]
  for (const d of data) {
    if (d.pct > 0) {
      segments.push({ ...d, offset })
      offset += d.pct
    }
  }

  // Start at top (-90deg offset)
  const startOffset = circumference * 0.25

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff08" strokeWidth="16" />
      {total === 0 ? (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="#ffffff15"
          strokeWidth="16"
          strokeDasharray={`${circumference} ${circumference}`}
        />
      ) : (
        segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${seg.pct * circumference} ${circumference}`}
            strokeDashoffset={-(seg.offset * circumference) + startOffset}
            strokeLinecap="butt"
          />
        ))
      )}
    </svg>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const [total, processing, indexed, analyzed, failed] = await Promise.all([
    prisma.document.count({ where: { userId: session.user!.id } }),
    prisma.document.count({ where: { userId: session.user!.id, status: 'PROCESSING' } }),
    prisma.document.count({ where: { userId: session.user!.id, status: 'INDEXED' } }),
    prisma.document.count({ where: { userId: session.user!.id, status: 'ANALYZED' } }),
    prisma.document.count({ where: { userId: session.user!.id, status: 'FAILED' } }),
  ])

  const userName = session.user.name || session.user.email || 'Usuario'
  const firstName = userName.split(' ')[0].split('@')[0]

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Top header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">
            Bienvenido de nuevo, {firstName}!
          </h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            Explora tus certificaciones y sigue progresando hoy mismo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-cetiem-card border border-white/10 rounded-xl px-4 py-2 w-64">
            <Search className="h-4 w-4 text-cetiem-gray shrink-0" />
            <input
              type="text"
              placeholder="Certificado, Calendario, etc"
              className="bg-transparent text-sm text-cetiem-gray placeholder:text-cetiem-gray/50 outline-none w-full"
              readOnly
            />
          </div>
          {/* Icon buttons */}
          <button className="h-9 w-9 rounded-full bg-cetiem-card border border-white/10 flex items-center justify-center text-cetiem-gray hover:text-white transition-colors">
            <Bell className="h-4 w-4" />
          </button>
          <button className="h-9 w-9 rounded-full bg-cetiem-green flex items-center justify-center text-white">
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-3 gap-6 p-8 overflow-auto">
        {/* Left column — 2/3 */}
        <div className="col-span-2 space-y-6">

          {/* Certificaciones en progreso */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-semibold text-base text-white">
                  Tus certificaciones en progreso
                </h2>
                <p className="text-cetiem-gray text-xs mt-0.5">
                  Realiza un seguimiento de todas las certificaciones en curso y finalizados.
                </p>
              </div>
              <button className="text-cetiem-gray hover:text-white">
                <span className="text-lg leading-none">···</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Card 1 */}
              <div className="bg-[#0d1520] border border-white/5 rounded-xl overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-cetiem-teal/30 to-cetiem-green/20 flex items-center justify-center">
                  <FileText className="h-12 w-12 text-cetiem-green/60" />
                </div>
                <div className="p-4">
                  <h3 className="font-heading font-semibold text-sm text-white mb-1">
                    Reportes y exportación a CSV/PDF
                  </h3>
                  <p className="text-cetiem-gray text-xs mb-3 leading-relaxed">
                    Genera reportes detallados y exporta el análisis de tus documentos.
                  </p>
                  <Link
                    href="/dashboard/documents"
                    className="inline-block w-full text-center bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    iniciar un trámite
                  </Link>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#0d1520] border border-white/5 rounded-xl overflow-hidden">
                <div className="h-32 bg-gradient-to-br from-cetiem-green/20 to-cetiem-lime/10 flex items-center justify-center">
                  <Upload className="h-12 w-12 text-cetiem-lime/60" />
                </div>
                <div className="p-4">
                  <h3 className="font-heading font-semibold text-sm text-white mb-1">
                    Carga y gestión de documentos
                  </h3>
                  <p className="text-cetiem-gray text-xs mb-3 leading-relaxed">
                    Sube documentos PDF para análisis automático con IA.
                  </p>
                  <Link
                    href="/dashboard/upload"
                    className="inline-block w-full text-center border border-cetiem-green text-cetiem-green hover:bg-cetiem-green hover:text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Subir un documento
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Trámites activos */}
            <div className="bg-cetiem-green rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-xs font-medium">Trámites activos</span>
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-white">{total}</div>
              <Link href="/dashboard/documents" className="flex items-center gap-1 text-white/70 text-xs mt-2 hover:text-white transition-colors">
                Total →
              </Link>
            </div>

            {/* Revisiones */}
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs font-medium">Revisiones</span>
                <div className="h-8 w-8 rounded-lg bg-cetiem-teal/20 flex items-center justify-center">
                  <Search className="h-4 w-4 text-cetiem-teal" />
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-white">{processing + indexed}</div>
              <span className="text-cetiem-gray text-xs mt-2 block">Completado →</span>
            </div>

            {/* Certificaciones */}
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs font-medium">Certificaciones</span>
                <div className="h-8 w-8 rounded-lg bg-cetiem-lime/20 flex items-center justify-center">
                  <span className="text-cetiem-lime text-base">✓</span>
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-white">{analyzed}</div>
              <span className="text-cetiem-gray text-xs mt-2 block">Certificados →</span>
            </div>
          </div>
        </div>

        {/* Right column — 1/3 */}
        <div className="col-span-1">
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-semibold text-base text-white">Estados</h2>
                <p className="text-cetiem-gray text-xs">Código cromático</p>
              </div>
              <button className="text-cetiem-gray hover:text-white">
                <span className="text-lg leading-none">···</span>
              </button>
            </div>

            {/* Donut chart */}
            <div className="flex justify-center my-4 relative">
              <DonutChart
                analyzed={analyzed}
                processing={processing}
                indexed={indexed}
                failed={failed}
                total={total}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-2xl text-white">{total}</span>
                <span className="text-cetiem-gray text-xs">Enrolled</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 mt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-cetiem-gray/60 text-[10px]">#</span>
                <span className="text-cetiem-gray/60 text-[10px] ml-auto">Temas</span>
                <span className="text-cetiem-gray/60 text-[10px] w-12 text-right">Porcentaje</span>
              </div>
              {[
                { label: 'Aprobado',    color: 'bg-cetiem-lime',  count: analyzed,   },
                { label: 'In progress', color: 'bg-cetiem-amber', count: processing, },
                { label: 'Review',      color: 'bg-cetiem-teal',  count: indexed,    },
                { label: 'Hard stop',   color: 'bg-cetiem-red',   count: failed,     },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.color}`} />
                  <span className="text-white flex-1">{item.label}</span>
                  <span className="text-cetiem-gray w-10 text-right">{pct(item.count)}%</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4">
              <p className="text-cetiem-gray text-xs mb-3 leading-relaxed">
                Documentos analizados con IA: PageIndex + Cognee + FalkorDB.
              </p>
              <Link
                href="/dashboard/documents"
                className="block w-full text-center bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                Ver detalles
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
