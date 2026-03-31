"use client";

import React from "react";
import { useRole } from "@/lib/role-context";
import Link from "next/link";
import {
  FileText, Upload, Search, CheckCircle, Clock, AlertCircle,
  Building2, ClipboardList, Users, ArrowRight, Eye,
  TrendingUp, Shield, Award, RefreshCw, ShieldAlert,
  Network, ScrollText, Download, ChevronRight, MessageSquare, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocStats {
  total: number; processing: number; indexed: number; analyzed: number; failed: number;
}
interface GlobalStats {
  total: number; processing: number; analyzed: number; failed: number; users: number;
  approved: number; capaOpen: number;
}
interface RecentDoc {
  id: string; name: string; status: string; createdAt: Date; domain: string;
  certStatus?: string; esgScore?: number | null;
}
interface UserRow {
  id: string; name: string | null; email: string; companyName: string | null; createdAt: Date;
  _count: { documents: number };
}
interface GlobalDoc {
  id: string; name: string; status: string; createdAt: Date; domain: string;
  userId: string;
  user: { id: string; name: string | null; email: string; companyName: string | null };
  certifications: { status: string }[];
}
interface CompanyMeta {
  track: string | null; sprintLevel: string; companyName: string | null;
  assessor?: { name: string | null; email: string } | null;
}
interface CertStats {
  total: number; approved: number; rejected: number; capaOpen: number;
  esgScore?: number | null; certStatus?: string | null;
  certId?: string | null;
  certNotes?: string | null;
  certFindings?: any[];
  certVerdict?: string | null;
  publicToken?: string | null;
  assessedAt?: string | null;
}

interface Props {
  userName: string;
  stats: DocStats;
  recentDocs: RecentDoc[];
  globalStats: GlobalStats;
  allUsers: UserRow[];
  allDocsGlobal: GlobalDoc[];
  companyMeta?: CompanyMeta | null;
  certStats?: CertStats | null;
}

const DOC_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  PENDING:    { label: 'Pendiente',   color: 'text-cetiem-gray',  bg: 'bg-cetiem-gray/10',  icon: Clock },
  PROCESSING: { label: 'Procesando', color: 'text-cetiem-amber', bg: 'bg-cetiem-amber/10', icon: RefreshCw },
  INDEXED:    { label: 'Indexado',   color: 'text-cetiem-teal',  bg: 'bg-cetiem-teal/10',  icon: Search },
  ANALYZED:   { label: 'Analizado',  color: 'text-cetiem-lime',  bg: 'bg-cetiem-lime/10',  icon: CheckCircle },
  FAILED:     { label: 'Fallido',    color: 'text-cetiem-red',   bg: 'bg-cetiem-red/10',   icon: AlertCircle },
}

const CERT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:  { label: 'Aprobado',    color: 'text-cetiem-lime',  bg: 'bg-cetiem-lime/10' },
  IN_REVIEW: { label: 'En revisión', color: 'text-cetiem-amber', bg: 'bg-cetiem-amber/10' },
  REJECTED:  { label: 'Rechazado',   color: 'text-cetiem-red',   bg: 'bg-cetiem-red/10' },
  REVOKED:   { label: 'Revocado',    color: 'text-cetiem-red',   bg: 'bg-cetiem-red/10' },
  CAPA_OPEN: { label: 'CAPA Abierta',color: 'text-cetiem-amber', bg: 'bg-cetiem-amber/10' },
  DRAFT:     { label: 'Borrador',    color: 'text-cetiem-gray',  bg: 'bg-white/5' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? DOC_STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.color, cfg.bg)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  )
}

function CertBadge({ status }: { status: string }) {
  const cfg = CERT_STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.color, cfg.bg)}>
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

// ─── DICTAMEN BANNER — shown on company dashboard when assessor emits verdict ──
function DictamenBanner({ certStats, companyId }: { certStats: CertStats; companyId?: string }) {
  const { certStatus, certNotes, certFindings = [], capaOpen, esgScore, assessedAt, certId } = certStats
  if (!certStatus || certStatus === 'DRAFT') return null

  const findingsSummary = {
    nc:  (certFindings as any[]).filter(f => f.type === 'NON_COMPLIANCE').length,
    obs: (certFindings as any[]).filter(f => f.type === 'OBSERVATION').length,
    comp:(certFindings as any[]).filter(f => f.type === 'COMPLIANCE').length,
  }

  if (certStatus === 'APPROVED') {
    return (
      <div className="bg-gradient-to-r from-cetiem-lime/15 to-cetiem-green/10 border border-cetiem-lime/30 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Award className="h-8 w-8 text-cetiem-lime shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-heading font-bold text-cetiem-lime text-base">Certificado ESG Aprobado</h3>
                {esgScore !== null && esgScore !== undefined && (
                  <span className="text-xs font-bold bg-cetiem-lime/20 text-cetiem-lime px-2 py-0.5 rounded-full">
                    Score {Math.round(esgScore)}%
                  </span>
                )}
              </div>
              {certNotes && (
                <p className="text-white/70 text-sm italic mb-2">"{certNotes}"</p>
              )}
              <p className="text-cetiem-gray/60 text-xs">
                {assessedAt ? `Emitido el ${new Date(assessedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Dictamen emitido'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/mi-certificado"
            className="shrink-0 flex items-center gap-2 bg-cetiem-lime hover:bg-cetiem-lime/90 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            <Download className="h-4 w-4" /> Ver Certificado
          </Link>
        </div>
      </div>
    )
  }

  if (certStatus === 'REJECTED') {
    return (
      <div className="bg-cetiem-red/10 border border-cetiem-red/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-cetiem-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-cetiem-red text-sm mb-2">Dictamen: No aprobado</h3>
            {certNotes && <p className="text-white/70 text-sm italic mb-2">"{certNotes}"</p>}
            {findingsSummary.nc > 0 && (
              <p className="text-cetiem-gray text-xs">{findingsSummary.nc} no conformidad{findingsSummary.nc !== 1 ? 'es' : ''} identificada{findingsSummary.nc !== 1 ? 's' : ''}</p>
            )}
            <p className="text-cetiem-gray/60 text-xs mt-1">Contacta a tu Assessor ESG para orientación.</p>
          </div>
        </div>
      </div>
    )
  }

  // IN_REVIEW or CAPA_OPEN
  return (
    <div className="bg-cetiem-amber/10 border border-cetiem-amber/30 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <MessageSquare className="h-6 w-6 text-cetiem-amber shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-heading font-semibold text-cetiem-amber text-sm">
              {certStatus === 'CAPA_OPEN' ? 'Acciones correctivas requeridas' : 'Revisión en curso — feedback del Assessor'}
            </h3>
          </div>
          {certNotes && (
            <p className="text-white text-sm italic mb-3 bg-white/5 rounded-xl px-3 py-2 border-l-2 border-cetiem-amber/40">
              "{certNotes}"
            </p>
          )}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {findingsSummary.nc > 0 && (
              <span className="bg-cetiem-red/15 text-cetiem-red px-2 py-1 rounded-lg font-medium">
                {findingsSummary.nc} No conformidad{findingsSummary.nc !== 1 ? 'es' : ''}
              </span>
            )}
            {findingsSummary.obs > 0 && (
              <span className="bg-cetiem-amber/15 text-cetiem-amber px-2 py-1 rounded-lg font-medium">
                {findingsSummary.obs} Observación{findingsSummary.obs !== 1 ? 'es' : ''}
              </span>
            )}
            {findingsSummary.comp > 0 && (
              <span className="bg-cetiem-lime/10 text-cetiem-lime px-2 py-1 rounded-lg font-medium">
                {findingsSummary.comp} Cumplimiento{findingsSummary.comp !== 1 ? 's' : ''}
              </span>
            )}
            {capaOpen > 0 && (
              <Link href="/dashboard/capa"
                className="bg-cetiem-red/15 text-cetiem-red px-2 py-1 rounded-lg font-medium hover:bg-cetiem-red/25 transition-colors flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                {capaOpen} ticket{capaOpen !== 1 ? 's' : ''} CAPA
              </Link>
            )}
          </div>
          {certStatus === 'CAPA_OPEN' && capaOpen > 0 && (
            <Link href="/dashboard/capa" className="mt-3 inline-flex items-center gap-2 text-xs bg-cetiem-amber text-black font-medium px-3 py-1.5 rounded-lg hover:bg-cetiem-amber/90 transition-colors">
              Gestionar acciones correctivas <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COMPANY VIEW ─────────────────────────────────────────────────────────────
function CompanyDashboard({ userName, stats, recentDocs, companyMeta, certStats }: Pick<Props, 'userName' | 'stats' | 'recentDocs' | 'companyMeta' | 'certStats'>) {
  const firstName = userName.split(' ')[0].split('@')[0]
  const pct = (n: number) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0

  const hasCert      = (certStats?.total ?? 0) > 0
  const certApproved = (certStats?.approved ?? 0) > 0
  const capaOpen     = certStats?.capaOpen ?? 0

  const TRACK_LABEL: Record<string, string> = {
    A: 'Track A — Industria', B: 'Track B — Construcción', C: 'Track C — Tecnología',
  }
  const SPRINT_LABEL: Record<string, string> = {
    STARTUP: 'Sprint 1 — Startup', PEQUENA: 'Sprint 2 — Pequeña', MEDIANA: 'Sprint 3 — Mediana',
  }

  // 4 steps: each is independently determined
  const certSteps = [
    { n: 1, label: 'Documentos\nSubidos',       done: stats.total > 0,      active: stats.total === 0 },
    { n: 2, label: 'Análisis IA\n· NVIDIA NIM', done: stats.analyzed > 0,   active: stats.total > 0 && stats.analyzed === 0 },
    { n: 3, label: 'Revisión\nAssessor ESG',    done: hasCert,               active: stats.analyzed > 0 && !hasCert },
    { n: 4, label: 'Certificado\nESG Emitido',  done: certApproved,          active: hasCert && !certApproved },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Bienvenido, {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Sigue el progreso de tu proceso de certificación ESG.</p>
        </div>
        <Link href="/dashboard/upload" className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl">
          <Upload className="h-4 w-4" /> Subir Documento
        </Link>
      </div>

      <div className="flex-1 p-8 grid grid-cols-3 gap-6 overflow-auto">
        <div className="col-span-2 space-y-6">

          {/* Dictamen banner — shown when assessor has issued verdict */}
          {certStats && <DictamenBanner certStats={certStats} />}

          {/* CAPA alert — only when no dictamen banner (no duplication) */}
          {capaOpen > 0 && (!certStats?.certStatus || certStats.certStatus === 'DRAFT') && (
            <Link href="/dashboard/capa" className="flex items-center gap-3 bg-cetiem-amber/10 border border-cetiem-amber/30 rounded-2xl p-4 hover:border-cetiem-amber/50 transition-colors">
              <ShieldAlert className="h-5 w-5 text-cetiem-amber shrink-0" />
              <div className="flex-1">
                <p className="text-cetiem-amber font-semibold text-sm">
                  {capaOpen} ticket{capaOpen !== 1 ? 's' : ''} CAPA abierto{capaOpen !== 1 ? 's' : ''}
                </p>
                <p className="text-cetiem-amber/70 text-xs">Tienes acciones correctivas pendientes con plazo de 30 días. Haz clic para gestionarlos.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-cetiem-amber shrink-0" />
            </Link>
          )}

          {/* Progreso de certificación */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-6">
            <h2 className="font-heading font-semibold text-white mb-1">Tu proceso de certificación</h2>
            <p className="text-cetiem-gray text-xs mb-5">Completa cada etapa para obtener tu certificado ESG.</p>
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
                    <span className={cn("text-[10px] text-center leading-tight whitespace-pre-line",
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

          {/* KPIs — empresa-friendly */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cetiem-green rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-xs">Mis Documentos</span>
                <FileText className="h-4 w-4 text-white/60" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.total}</div>
              <Link href="/dashboard/documents" className="text-white/70 text-xs mt-1 flex items-center gap-1 hover:text-white">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">Analizados por IA</span>
                <CheckCircle className="h-4 w-4 text-cetiem-lime" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.analyzed}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Listos para assessor</span>
            </div>
            <div className={cn("rounded-2xl p-5", certApproved ? "bg-cetiem-lime/10 border border-cetiem-lime/20" : "bg-cetiem-card border border-white/5")}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-xs", certApproved ? "text-cetiem-lime" : "text-cetiem-gray")}>Certificaciones</span>
                <Award className={cn("h-4 w-4", certApproved ? "text-cetiem-lime" : "text-cetiem-gray/40")} />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{certStats?.approved ?? 0}</div>
              <span className={cn("text-xs mt-1 block", certApproved ? "text-cetiem-lime/70" : "text-cetiem-gray")}>
                {certApproved ? 'ESG aprobadas' : 'Sin aprobaciones aún'}
              </span>
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
                <Link href="/dashboard/upload" className="inline-block mt-3 bg-cetiem-green text-white text-sm px-4 py-2 rounded-xl">
                  Subir primer documento
                </Link>
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.certStatus && <CertBadge status={doc.certStatus} />}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-cetiem-gray/30 group-hover:text-cetiem-green transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          {/* Distribución de estados */}
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
                { label: 'Procesando',  color: 'bg-cetiem-amber', count: stats.processing },
                { label: 'Indexados',   color: 'bg-cetiem-teal',  count: stats.indexed },
                { label: 'Fallidos',    color: 'bg-cetiem-red',   count: stats.failed },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', item.color)} />
                  <span className="text-white flex-1">{item.label}</span>
                  <span className="text-cetiem-gray">{pct(item.count)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Perfil ESG */}
          {companyMeta?.track && (
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <h2 className="font-heading font-semibold text-white text-sm mb-3">Perfil ESG</h2>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cetiem-gray">Track sectorial</span>
                  <span className="font-medium text-cetiem-teal">{TRACK_LABEL[companyMeta.track] || companyMeta.track}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cetiem-gray">Sprint actual</span>
                  <span className="font-medium text-cetiem-lime">{SPRINT_LABEL[companyMeta.sprintLevel] || companyMeta.sprintLevel}</span>
                </div>
                {certStats && certStats.total > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cetiem-gray">Dictámenes</span>
                    <span className="text-white">{certStats.total} total · <span className="text-cetiem-lime">{certStats.approved} aprob.</span></span>
                  </div>
                )}
                {companyMeta.assessor && (
                  <div className="pt-2 mt-1 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-cetiem-amber shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-cetiem-gray/50 uppercase tracking-wider">Assessor ESG asignado</p>
                        <p className="text-xs text-white font-medium truncate">{companyMeta.assessor.name || companyMeta.assessor.email}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA — cambia según estado */}
          {certApproved ? (
            <Link href="/dashboard/documents" className="block bg-cetiem-lime/10 border border-cetiem-lime/20 rounded-2xl p-5 hover:border-cetiem-lime/40 transition-colors">
              <Award className="h-8 w-8 text-cetiem-lime mb-3" />
              <h3 className="font-heading font-semibold text-white text-sm mb-1">Certificado ESG Activo</h3>
              <p className="text-cetiem-gray/70 text-xs mb-3 leading-relaxed">Tu certificación está aprobada. Descárgala desde el detalle del documento.</p>
              <span className="text-cetiem-lime text-xs font-medium flex items-center gap-1">
                Ver documentos <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          ) : (
            <div className="bg-gradient-to-br from-cetiem-green/20 to-cetiem-teal/10 border border-cetiem-green/20 rounded-2xl p-5">
              <Award className="h-8 w-8 text-cetiem-green mb-3" />
              <h3 className="font-heading font-semibold text-white text-sm mb-1">Obtén tu Certificación ESG</h3>
              <p className="text-cetiem-gray/70 text-xs mb-4 leading-relaxed">Sube todos tus documentos y un Data Assessor revisará tu expediente.</p>
              <Link href="/dashboard/upload" className="block text-center bg-cetiem-green hover:bg-cetiem-green/90 text-white text-xs font-medium py-2 rounded-lg transition-colors">
                Subir documentos
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ASSESSOR VIEW ─────────────────────────────────────────────────────────────
function AssessorDashboard({ userName, globalStats, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allDocsGlobal'>) {
  const firstName = userName.split(' ')[0].split('@')[0]
  const queue = allDocsGlobal.filter(d => d.status === 'ANALYZED' || d.status === 'INDEXED')

  const quickActions = [
    { href: '/dashboard/queue',     label: 'Cola de Revisión',    icon: ClipboardList, color: 'text-cetiem-amber', bg: 'bg-cetiem-amber/10', border: 'border-cetiem-amber/20', count: queue.length },
    { href: '/dashboard/companies', label: 'Empresas Asignadas',  icon: Building2,     color: 'text-cetiem-teal',  bg: 'bg-cetiem-teal/10',  border: 'border-cetiem-teal/20',  count: null },
    { href: '/dashboard/capa',      label: 'Tickets CAPA',        icon: ShieldAlert,   color: 'text-cetiem-red',   bg: 'bg-cetiem-red/10',   border: 'border-cetiem-red/20',   count: globalStats.capaOpen },
    { href: '/dashboard/graph',     label: 'Grafo Global',        icon: Network,       color: 'text-cetiem-lime',  bg: 'bg-cetiem-lime/10',  border: 'border-cetiem-lime/20',  count: null },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Panel Assessor — {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Revisión de documentos y emisión de dictámenes.</p>
        </div>
        <Link
          href="/dashboard/queue"
          className={cn("flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors",
            queue.length > 0
              ? "bg-cetiem-amber text-black hover:bg-cetiem-amber/90"
              : "border border-white/10 text-cetiem-gray hover:text-white"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          {queue.length > 0 ? `${queue.length} pendiente${queue.length !== 1 ? 's' : ''} en cola` : 'Cola de revisión'}
        </Link>
      </div>

      <div className="flex-1 p-8 grid grid-cols-3 gap-6 overflow-auto">
        <div className="col-span-2 space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-cetiem-amber/10 border border-cetiem-amber/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-amber text-xs font-medium">Por Revisar</span>
                <ClipboardList className="h-4 w-4 text-cetiem-amber" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{queue.length}</div>
              <span className="text-cetiem-amber/60 text-xs mt-1 block">En cola</span>
            </div>
            <div className="bg-cetiem-lime/10 border border-cetiem-lime/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-lime text-xs font-medium">Aprobados</span>
                <CheckCircle className="h-4 w-4 text-cetiem-lime" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{globalStats.approved}</div>
              <span className="text-cetiem-lime/60 text-xs mt-1 block">Certificados emitidos</span>
            </div>
            <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-cetiem-gray text-xs">Empresas</span>
                <Building2 className="h-4 w-4 text-cetiem-teal" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{globalStats.users}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Registradas</span>
            </div>
            <div className={cn("rounded-2xl p-5 border", globalStats.capaOpen > 0 ? "bg-cetiem-red/10 border-cetiem-red/20" : "bg-cetiem-card border-white/5")}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-xs", globalStats.capaOpen > 0 ? "text-cetiem-red" : "text-cetiem-gray")}>CAPA Abiertos</span>
                <ShieldAlert className={cn("h-4 w-4", globalStats.capaOpen > 0 ? "text-cetiem-red" : "text-cetiem-gray/40")} />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{globalStats.capaOpen}</div>
              <span className="text-cetiem-gray text-xs mt-1 block">Pendientes de cierre</span>
            </div>
          </div>

          {/* Cola de revisión */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-semibold text-white text-sm">Cola de Revisión</h2>
                <p className="text-cetiem-gray/60 text-xs">Documentos analizados por IA listos para dictamen</p>
              </div>
              <Link href="/dashboard/queue" className="text-cetiem-green text-xs hover:underline flex items-center gap-1">
                Ver cola completa <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {queue.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-cetiem-lime/30 mx-auto mb-3" />
                <p className="text-cetiem-gray text-sm">Cola vacía — sin documentos pendientes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.slice(0, 5).map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                    <div className="h-8 w-8 bg-cetiem-amber/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-cetiem-amber" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-cetiem-gray/50 text-[10px]">
                        {doc.user.companyName || doc.user.name || doc.user.email}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <Link
                      href={`/dashboard/review/company/${doc.userId}`}
                      className="flex items-center gap-1 text-xs bg-cetiem-amber hover:bg-cetiem-amber/90 text-black font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <Eye className="h-3 w-3" /> Revisar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">
          {/* Acciones rápidas */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <h2 className="font-heading font-semibold text-white text-sm mb-3">Acciones Rápidas</h2>
            <div className="space-y-2">
              {quickActions.map(action => {
                const Icon = action.icon
                return (
                  <Link key={action.href} href={action.href}
                    className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-white/5", action.border, "border-opacity-30")}
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", action.bg)}>
                      <Icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <span className="text-white text-sm flex-1">{action.label}</span>
                    {action.count !== null && action.count > 0 && (
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", action.bg, action.color)}>
                        {action.count}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-cetiem-gray/30 shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <h2 className="font-heading font-semibold text-white text-sm mb-4">Actividad Reciente</h2>
            <div className="space-y-3">
              {allDocsGlobal.slice(0, 6).map(doc => {
                const certStatus = doc.certifications[0]?.status
                return (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="flex items-start gap-2 hover:opacity-80 transition-opacity">
                    <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                      certStatus === 'APPROVED' ? 'bg-cetiem-lime' :
                      certStatus === 'REJECTED' ? 'bg-cetiem-red' :
                      doc.status === 'ANALYZED' ? 'bg-cetiem-teal' :
                      doc.status === 'PROCESSING' ? 'bg-cetiem-amber' : 'bg-cetiem-gray'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{doc.name}</p>
                      <p className="text-cetiem-gray/50 text-[10px]">{doc.user.companyName || doc.user.name || doc.user.email}</p>
                    </div>
                    {certStatus
                      ? <CertBadge status={certStatus} />
                      : <StatusBadge status={doc.status} />
                    }
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ADMIN VIEW ─────────────────────────────────────────────────────────────
function AdminDashboard({ userName, globalStats, allUsers, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allUsers' | 'allDocsGlobal'>) {
  const firstName = userName.split(' ')[0].split('@')[0]

  const kpis = [
    { label: 'Empresas',         value: globalStats.users,    color: 'text-cetiem-lime',  icon: Building2,   bg: 'bg-cetiem-lime/10',  href: '/dashboard/companies' },
    { label: 'Documentos',       value: globalStats.total,    color: 'text-cetiem-teal',  icon: FileText,    bg: 'bg-cetiem-teal/10',  href: '/dashboard/documents' },
    { label: 'Certificados ESG', value: globalStats.approved, color: 'text-cetiem-green', icon: Award,       bg: 'bg-cetiem-green/10', href: '/dashboard/documents' },
    { label: 'CAPA Abiertos',    value: globalStats.capaOpen, color: 'text-cetiem-amber', icon: ShieldAlert, bg: 'bg-cetiem-amber/10', href: '/dashboard/capa' },
    { label: 'IA Analizados',    value: globalStats.analyzed, color: 'text-white',        icon: CheckCircle, bg: 'bg-white/5',         href: '/dashboard/documents' },
  ]

  const adminActions = [
    { href: '/dashboard/companies',  label: 'Gestionar Empresas',    icon: Building2,   color: 'text-cetiem-teal' },
    { href: '/dashboard/assessors',  label: 'Ver Assessors',         icon: Users,       color: 'text-cetiem-lime' },
    { href: '/dashboard/capa',       label: 'Tickets CAPA',          icon: ShieldAlert, color: 'text-cetiem-amber' },
    { href: '/dashboard/logs',       label: 'Logs de Auditoría',     icon: ScrollText,  color: 'text-cetiem-gray' },
    { href: '/api/export/documents', label: 'Exportar CSV',          icon: Download,    color: 'text-cetiem-green', external: true },
    { href: '/dashboard/graph',      label: 'Grafo Global',          icon: Network,     color: 'text-cetiem-lime' },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Super Admin — {firstName}</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Gestión global de empresas, assessors y certificaciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/logs" className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-cetiem-gray hover:text-white text-sm px-3 py-2 rounded-xl transition-colors">
            <ScrollText className="h-4 w-4" /> Logs
          </Link>
          <a href="/api/export/documents" className="flex items-center gap-2 border border-white/10 hover:border-cetiem-lime/40 text-cetiem-gray hover:text-cetiem-lime text-sm px-3 py-2 rounded-xl transition-colors">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
          <Link href="/dashboard/companies" className="flex items-center gap-2 bg-cetiem-green hover:bg-cetiem-green/90 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Building2 className="h-4 w-4" /> Gestionar Empresas
          </Link>
        </div>
      </div>

      <div className="flex-1 p-8 space-y-6 overflow-auto">

        {/* KPI grid — clickable */}
        <div className="grid grid-cols-5 gap-4">
          {kpis.map(kpi => {
            const Icon = kpi.icon
            return (
              <Link key={kpi.label} href={kpi.href} className="bg-cetiem-card border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-3", kpi.bg)}>
                  <Icon className={cn("h-4 w-4", kpi.color)} />
                </div>
                <div className={cn("text-3xl font-heading font-bold", kpi.color)}>{kpi.value}</div>
                <p className="text-cetiem-gray text-[10px] mt-1 leading-tight">{kpi.label}</p>
              </Link>
            )
          })}
        </div>

        {/* Acciones administrativas */}
        <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
          <h2 className="font-heading font-semibold text-white text-sm mb-3">Acciones Administrativas</h2>
          <div className="grid grid-cols-6 gap-3">
            {adminActions.map(action => {
              const Icon = action.icon
              const content = (
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/5 hover:border-white/15 hover:bg-white/3 transition-colors text-center">
                  <Icon className={cn("h-5 w-5", action.color)} />
                  <span className="text-cetiem-gray text-[10px] leading-tight">{action.label}</span>
                </div>
              )
              return action.external
                ? <a key={action.href} href={action.href}>{content}</a>
                : <Link key={action.href} href={action.href}>{content}</Link>
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Empresas */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-sm">Empresas Registradas</h2>
              <Link href="/dashboard/companies" className="text-cetiem-green text-xs hover:underline">Gestionar →</Link>
            </div>
            <div className="space-y-2">
              {allUsers.slice(0, 7).map(user => (
                <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-cetiem-green/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-cetiem-green">
                      {(user.companyName || user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{user.companyName || user.name || user.email}</p>
                    <p className="text-cetiem-gray/50 text-[10px] truncate">{user.email}</p>
                  </div>
                  <span className="text-cetiem-teal text-[10px] font-medium bg-cetiem-teal/10 px-2 py-0.5 rounded-full shrink-0">
                    {user._count.documents} doc{user._count.documents !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actividad global con cert status */}
          <div className="bg-cetiem-card border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-semibold text-white text-sm">Actividad Global</h2>
              <Link href="/dashboard/documents" className="text-cetiem-green text-xs hover:underline">Ver todos →</Link>
            </div>
            <div className="space-y-2">
              {allDocsGlobal.slice(0, 7).map(doc => {
                const certStatus = doc.certifications[0]?.status
                return (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                      certStatus === 'APPROVED' ? 'bg-cetiem-lime' :
                      certStatus === 'REJECTED' ? 'bg-cetiem-red' :
                      doc.status === 'ANALYZED' ? 'bg-cetiem-teal' :
                      doc.status === 'PROCESSING' ? 'bg-cetiem-amber' : 'bg-cetiem-gray'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs truncate">{doc.name}</p>
                      <p className="text-cetiem-gray/50 text-[10px] truncate">{doc.user.companyName || doc.user.name || doc.user.email}</p>
                    </div>
                    {certStatus
                      ? <CertBadge status={certStatus} />
                      : <StatusBadge status={doc.status} />
                    }
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export function DashboardView(props: Props) {
  const { role } = useRole()

  if (role === 'assessor') return <AssessorDashboard userName={props.userName} globalStats={props.globalStats} allDocsGlobal={props.allDocsGlobal} />
  if (role === 'admin')    return <AdminDashboard    userName={props.userName} globalStats={props.globalStats} allUsers={props.allUsers} allDocsGlobal={props.allDocsGlobal} />
  return <CompanyDashboard userName={props.userName} stats={props.stats} recentDocs={props.recentDocs} companyMeta={props.companyMeta} certStats={props.certStats} />
}
