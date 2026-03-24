"use client";

import { useRole } from "@/lib/role-context";
import Link from "next/link";
import {
  FileText, Upload, Search, Bell, CheckCircle, Clock, AlertCircle,
  Building2, ClipboardList, BarChart3, Users, ArrowRight, Eye,
  TrendingUp, Shield, Award, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocStats {
  total: number; processing: number; indexed: number; analyzed: number; failed: number;
}
interface GlobalStats {
  total: number; processing: number; analyzed: number; failed: number; users: number;
}
interface RecentDoc {
  id: string; name: string; status: string; createdAt: Date; domain: string;
}
interface UserRow {
  id: string; name: string | null; email: string; createdAt: Date;
  _count: { documents: number };
}
interface GlobalDoc extends RecentDoc {
  user: { name: string | null; email: string };
}

interface Props {
  userName: string;
  stats: DocStats;
  recentDocs: RecentDoc[];
  globalStats: GlobalStats;
  allUsers: UserRow[];
  allDocsGlobal: GlobalDoc[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  PENDING:    { label: 'Pendiente',   color: 'text-cetiem-gray',  bg: 'bg-cetiem-gray/10',  icon: Clock },
  PROCESSING: { label: 'Procesando', color: 'text-cetiem-amber', bg: 'bg-cetiem-amber/10', icon: RefreshCw },
  INDEXED:    { label: 'Indexado',   color: 'text-cetiem-teal',  bg: 'bg-cetiem-teal/10',  icon: Search },
  ANALYZED:   { label: 'Analizado',  color: 'text-cetiem-lime',  bg: 'bg-cetiem-lime/10',  icon: CheckCircle },
  FAILED:     { label: 'Fallido',    color: 'text-cetiem-red',   bg: 'bg-cetiem-red/10',   icon: AlertCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.color, cfg.bg)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

function DonutChart({ analyzed, processing, indexed, failed, total }: DocStats) {
  const safeTotal = total || 1
  const r = 44; const cx = 56; const cy = 56
  const circ = 2 * Math.PI * r
  const data = [
    { pct: analyzed / safeTotal,   color: '#9fc031' },
    { pct: processing / safeTotal, color: '#ffbf00' },
    { pct: indexed / safeTotal,    color: '#1e7d93' },
    { pct: failed / safeTotal,     color: '#aa3939' },
  ]
  let offset = 0
  const segments = data.filter(d => d.pct > 0).map(d => {
    const s = { ...d, offset }; offset += d.pct; return s
  })
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff08" strokeWidth="14" />
      {total === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff10" strokeWidth="14" strokeDasharray={`${circ} ${circ}`} />
        : segments.map((seg, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14"
              strokeDasharray={`${seg.pct * circ} ${circ}`}
              strokeDashoffset={-(seg.offset * circ) + circ * 0.25} />
          ))
      }
    </svg>
  )
}

// ─── COMPANY VIEW ────────────────────────────────────────────────────
function CompanyDashboard({ userName, stats, recentDocs }: Pick<Props, 'userName' | 'stats' | 'recentDocs'>) {
  const firstName = userName.split(' ')[0].split('@')[0]
  const pct = (n: number) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0

  const certSteps = [
    { n: 1, label: 'Documentos Subidos',   done: stats.total > 0,      active: stats.total === 0 },
    { n: 2, label: 'Análisis IA',          done: stats.analyzed > 0,   active: stats.processing > 0 },
    { n: 3, label: 'Revisión Assessor',    done: false,                 active: stats.analyzed > 0 },
    { n: 4, label: 'Certificado Emitido',  done: false,                 active: false },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Bienvenido, {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Sigue el progreso de tu proceso de certificación.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-9 w-9 rounded-full bg-cetiem-card border border-white/10 flex items-center justify-center text-cetiem-gray hover:text-white">
            <Bell className="h-4 w-4" />
          </button>
          <Link href="/dashboard/upload" className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Upload className="h-4 w-4" /> Subir Documento
          </Link>
        </div>
      </div>

      <div className="flex-1 p-8 grid grid-cols-3 gap-6 overflow-auto">
        <div className="col-span-2 space-y-6">

          {/* Progreso de certificación */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-white mb-1">Tu proceso de certificación</h2>
            <p className="text-cetiem-gray text-xs mb-5">Completa cada etapa para obtener tu certificado.</p>
            <div className="flex items-center gap-0">
              {certSteps.map((step, i) => (
                <div key={step.n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 mb-2",
                      step.done   ? "bg-cetiem-green border-cetiem-green text-white" :
                      step.active ? "bg-cetiem-amber/20 border-cetiem-amber text-cetiem-amber" :
                                    "bg-white/5 border-white/10 text-cetiem-gray/40"
                    )}>
                      {step.done ? <CheckCircle className="h-4 w-4" /> : step.n}
                    </div>
                    <span className={cn("text-[10px] text-center leading-tight",
                      step.done ? "text-cetiem-green" : step.active ? "text-cetiem-amber" : "text-cetiem-gray/40"
                    )}>{step.label}</span>
                  </div>
                  {i < certSteps.length - 1 && (
                    <div className={cn("h-0.5 w-full mx-1 mb-4 rounded-full",
                      step.done ? "bg-cetiem-green" : "bg-white/5"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cetiem-green rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-xs">Documentos</span>
                <FileText className="h-4 w-4 text-white/60" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.total}</div>
              <Link href="/dashboard/documents" className="text-white/70 text-xs mt-1 flex items-center gap-1 hover:text-white">Ver todos <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">En Revisión</span>
                <Search className="h-4 w-4 text-cetiem-teal" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.processing + stats.indexed}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Por procesar</span>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">Analizados</span>
                <CheckCircle className="h-4 w-4 text-cetiem-lime" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.analyzed}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Listos para auditoría</span>
            </div>
          </div>

          {/* Documentos recientes */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-sm">Documentos Recientes</h2>
              <Link href="/dashboard/documents" className="text-cetiem-green text-xs hover:underline">Ver todos</Link>
            </div>
            {recentDocs.length === 0 ? (
              <div className="text-center py-8">
                <Upload className="h-10 w-10 text-cetiem-gray/20 mx-auto mb-3" />
                <p className="text-cetiem-gray text-sm">Aún no has subido documentos.</p>
                <Link href="/dashboard/upload" className="inline-block mt-3 bg-cetiem-green text-white text-sm px-4 py-2 rounded-xl">Subir primer documento</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDocs.map(doc => (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                    <div className="h-8 w-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-cetiem-gray" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-cetiem-gray/50 text-[10px]">{new Date(doc.createdAt).toLocaleDateString('es-MX')}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <ArrowRight className="h-3.5 w-3.5 text-cetiem-gray/30 group-hover:text-cetiem-green transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: chart + leyenda */}
        <div className="space-y-4">
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <h2 className="font-heading font-semibold text-white text-sm mb-1">Estado de Documentos</h2>
            <p className="text-cetiem-gray text-xs mb-4">Distribución actual</p>
            <div className="flex justify-center relative mb-4">
              <DonutChart {...stats} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-2xl text-white">{stats.total}</span>
                <span className="text-cetiem-gray text-[10px]">Total</span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Analizados',  color: 'bg-cetiem-lime',  count: stats.analyzed },
                { label: 'Procesando', color: 'bg-cetiem-amber', count: stats.processing },
                { label: 'Indexados',  color: 'bg-cetiem-teal',  count: stats.indexed },
                { label: 'Fallidos',   color: 'bg-cetiem-red',   count: stats.failed },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', item.color)} />
                  <span className="text-white flex-1">{item.label}</span>
                  <span className="text-cetiem-gray">{pct(item.count)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cetiem-green/20 to-cetiem-teal/10 border border-cetiem-green/20 rounded-2xl p-5">
            <Award className="h-8 w-8 text-cetiem-green mb-3" />
            <h3 className="font-heading font-semibold text-white text-sm mb-1">Obtén tu Certificación</h3>
            <p className="text-cetiem-gray/70 text-xs mb-4 leading-relaxed">Sube todos tus documentos y un Data Assessor revisará tu expediente.</p>
            <Link href="/dashboard/upload" className="block text-center bg-cetiem-green hover:bg-cetiem-green/90 text-white text-xs font-medium py-2 rounded-lg transition-colors">
              Iniciar proceso
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ASSESSOR VIEW ────────────────────────────────────────────────────
function AssessorDashboard({ userName, globalStats, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allDocsGlobal'>) {
  const firstName = userName.split(' ')[0].split('@')[0]
  const queue = allDocsGlobal.filter(d => d.status === 'ANALYZED' || d.status === 'INDEXED')

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Panel Assessor — {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Revisión de documentos y emisión de dictámenes.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs font-medium px-3 py-1 rounded-full border",
            queue.length > 0 ? "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/30" : "text-cetiem-gray bg-white/5 border-white/10"
          )}>
            {queue.length} pendiente{queue.length !== 1 ? 's' : ''} de revisión
          </span>
        </div>
      </div>

      <div className="flex-1 p-8 grid grid-cols-3 gap-6 overflow-auto">
        <div className="col-span-2 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cetiem-amber/10 border border-cetiem-amber/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-amber text-xs font-medium">Por Revisar</span>
                <ClipboardList className="h-4 w-4 text-cetiem-amber" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{queue.length}</div>
              <span className="text-cetiem-amber/60 text-xs mt-1 block">Documentos en cola</span>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">Empresas</span>
                <Building2 className="h-4 w-4 text-cetiem-teal" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{globalStats.users}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Registradas</span>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">Analizados IA</span>
                <CheckCircle className="h-4 w-4 text-cetiem-lime" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{globalStats.analyzed}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Listos para dictamen</span>
            </div>
          </div>

          {/* Cola de revisión */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-semibold text-white text-sm">Cola de Revisión</h2>
                <p className="text-cetiem-gray/60 text-xs">Documentos analizados por IA listos para auditoría humana</p>
              </div>
              <Link href="/dashboard/queue" className="text-cetiem-green text-xs hover:underline">Ver todo</Link>
            </div>
            {queue.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-cetiem-lime/30 mx-auto mb-3" />
                <p className="text-cetiem-gray text-sm">Cola vacía — sin documentos pendientes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.slice(0, 6).map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                    <div className="h-8 w-8 bg-cetiem-amber/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-cetiem-amber" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-cetiem-gray/50 text-[10px]">{doc.user.name || doc.user.email}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <Link href={`/dashboard/review/${doc.id}`}
                      className="flex items-center gap-1 text-xs bg-cetiem-amber hover:bg-cetiem-amber/90 text-black font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0">
                      <Eye className="h-3 w-3" /> Revisar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: last activity */}
        <div className="space-y-4">
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <h2 className="font-heading font-semibold text-white text-sm mb-4">Actividad Reciente</h2>
            <div className="space-y-3">
              {allDocsGlobal.slice(0, 6).map(doc => (
                <div key={doc.id} className="flex items-start gap-2">
                  <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                    doc.status === 'ANALYZED' ? 'bg-cetiem-lime' :
                    doc.status === 'PROCESSING' ? 'bg-cetiem-amber' :
                    doc.status === 'FAILED' ? 'bg-cetiem-red' : 'bg-cetiem-teal'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{doc.name}</p>
                    <p className="text-cetiem-gray/50 text-[10px]">{doc.user.name || doc.user.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-cetiem-teal/10 border border-cetiem-teal/20 rounded-2xl p-5">
            <Shield className="h-7 w-7 text-cetiem-teal mb-3" />
            <h3 className="font-heading font-semibold text-white text-sm mb-1">Consola Split-View</h3>
            <p className="text-cetiem-gray/70 text-xs mb-4 leading-relaxed">
              Abre el visor PDF con el formulario de dictamen lado a lado.
            </p>
            <Link href="/dashboard/companies" className="block text-center border border-cetiem-teal/40 hover:bg-cetiem-teal/10 text-cetiem-teal text-xs font-medium py-2 rounded-lg transition-colors">
              Ver Empresas
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────
function AdminDashboard({ userName, globalStats, allUsers, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allUsers' | 'allDocsGlobal'>) {
  const firstName = userName.split(' ')[0].split('@')[0]

  const kpis = [
    { label: 'Empresas Registradas', value: globalStats.users,      color: 'text-cetiem-lime',  icon: Building2, bg: 'bg-cetiem-lime/10' },
    { label: 'Documentos Totales',   value: globalStats.total,      color: 'text-cetiem-teal',  icon: FileText,  bg: 'bg-cetiem-teal/10' },
    { label: 'Análisis IA',          value: globalStats.analyzed,   color: 'text-cetiem-green', icon: TrendingUp, bg: 'bg-cetiem-green/10' },
    { label: 'Procesando',           value: globalStats.processing, color: 'text-cetiem-amber', icon: RefreshCw, bg: 'bg-cetiem-amber/10' },
    { label: 'Fallidos',             value: globalStats.failed,     color: 'text-cetiem-red',   icon: AlertCircle, bg: 'bg-cetiem-red/10' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Super Admin — {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Gestión global de empresas, assessors y certificaciones.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/companies" className="flex items-center gap-2 border border-white/10 hover:border-cetiem-lime/40 text-white text-sm px-4 py-2 rounded-xl transition-colors">
            <Building2 className="h-4 w-4" /> Gestionar Empresas
          </Link>
        </div>
      </div>

      <div className="flex-1 p-8 space-y-6 overflow-auto">

        {/* KPI grid */}
        <div className="grid grid-cols-5 gap-4">
          {kpis.map(kpi => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="bg-cetiem-card border border-white/5 rounded-2xl p-4">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-3", kpi.bg)}>
                  <Icon className={cn("h-4 w-4", kpi.color)} />
                </div>
                <div className={cn("text-3xl font-heading font-bold", kpi.color)}>{kpi.value}</div>
                <p className="text-cetiem-gray text-[10px] mt-1 leading-tight">{kpi.label}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Empresas */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-sm">Empresas Registradas</h2>
              <Link href="/dashboard/companies" className="text-cetiem-green text-xs hover:underline">Gestionar</Link>
            </div>
            <div className="space-y-2">
              {allUsers.slice(0, 6).map(user => (
                <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-cetiem-green/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-cetiem-green">
                      {(user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{user.name || user.email}</p>
                    <p className="text-cetiem-gray/50 text-[10px] truncate">{user.email}</p>
                  </div>
                  <span className="text-cetiem-teal text-[10px] font-medium bg-cetiem-teal/10 px-2 py-0.5 rounded-full">
                    {user._count.documents} doc{user._count.documents !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actividad reciente global */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-sm">Actividad Global</h2>
              <span className="text-cetiem-gray/40 text-xs">Últimos documentos</span>
            </div>
            <div className="space-y-2">
              {allDocsGlobal.slice(0, 6).map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                    doc.status === 'ANALYZED' ? 'bg-cetiem-lime' :
                    doc.status === 'PROCESSING' ? 'bg-cetiem-amber' :
                    doc.status === 'FAILED' ? 'bg-cetiem-red' : 'bg-cetiem-teal'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs truncate">{doc.name}</p>
                    <p className="text-cetiem-gray/50 text-[10px] truncate">{doc.user.name || doc.user.email}</p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ──────────────────────────────────────────────────────────────
export function DashboardView(props: Props) {
  const { role } = useRole()

  if (role === 'assessor') return <AssessorDashboard userName={props.userName} globalStats={props.globalStats} allDocsGlobal={props.allDocsGlobal} />
  if (role === 'admin')    return <AdminDashboard    userName={props.userName} globalStats={props.globalStats} allUsers={props.allUsers} allDocsGlobal={props.allDocsGlobal} />
  return <CompanyDashboard userName={props.userName} stats={props.stats} recentDocs={props.recentDocs} />
}
