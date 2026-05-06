"use client";

import React, { useEffect } from "react";
import { useRole } from "@/lib/role-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText, Upload, Search, CheckCircle, Clock, AlertCircle,
  Building2, ClipboardList, Users, ArrowRight, Eye,
  Award, RefreshCw, ShieldAlert,
  Network, ScrollText, Download, ChevronRight, MessageSquare, XCircle, Plus
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
  PENDING: { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-economia-gris/10', icon: Clock },
  PROCESSING: { label: 'Procesando', color: 'text-economia-warning', bg: 'bg-economia-warning/10', icon: RefreshCw },
  INDEXED: { label: 'Indexado', color: 'text-economia-info', bg: 'bg-economia-info/10', icon: Search },
  ANALYZED: { label: 'Analizado', color: 'text-economia-success', bg: 'bg-economia-success/10', icon: CheckCircle },
  FAILED: { label: 'Fallido', color: 'text-economia-error', bg: 'bg-economia-error/10', icon: AlertCircle },
}

const CERT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED: { label: 'Aprobado', color: 'text-economia-success', bg: 'bg-economia-success/10' },
  IN_REVIEW: { label: 'En revisión', color: 'text-economia-warning', bg: 'bg-economia-warning/10' },
  REJECTED: { label: 'Rechazado', color: 'text-economia-error', bg: 'bg-economia-error/10' },
  REVOKED: { label: 'Revocado', color: 'text-economia-error', bg: 'bg-economia-error/10' },
  CAPA_OPEN: { label: 'CAPA Abierta', color: 'text-economia-warning', bg: 'bg-economia-warning/10' },
  DRAFT: { label: 'Borrador', color: 'text-muted-foreground', bg: 'bg-muted' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? DOC_STATUS_CONFIG.PENDING
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider', cfg.color, cfg.bg)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  )
}

function CertBadge({ status }: { status: string }) {
  const cfg = CERT_STATUS_CONFIG[status]
  if (!cfg) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider', cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  )
}

function DonutChart({ analyzed, processing, indexed, failed, total }: DocStats) {
  const safeTotal = total || 1
  const r = 44; const cx = 56; const cy = 56
  const circ = 2 * Math.PI * r
  const data = [
    { pct: analyzed / safeTotal, color: '#1e5b4f' }, // verde — aprobado
    { pct: processing / safeTotal, color: '#a57f2c' }, // dorado — en proceso
    { pct: indexed / safeTotal, color: '#98989a' }, // gris — revisión
    { pct: failed / safeTotal, color: '#9b2247' }, // guinda — fallido
  ]
  let offset = 0
  const segments = data.filter(d => d.pct > 0).map(d => {
    const s = { ...d, offset }; offset += d.pct; return s
  })
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="14" />
      {total === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.10" strokeWidth="14" strokeDasharray={`${circ} ${circ}`} />
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
function DictamenBanner({ certStats, companyId: _companyId }: { certStats: CertStats; companyId?: string }) {
  const { certStatus, certNotes, certFindings = [], capaOpen, esgScore, assessedAt, certId: _certId } = certStats
  if (!certStatus || certStatus === 'DRAFT') return null

  const findingsSummary = {
    nc: (certFindings as any[]).filter(f => f.type === 'NON_COMPLIANCE').length,
    obs: (certFindings as any[]).filter(f => f.type === 'OBSERVATION').length,
    comp: (certFindings as any[]).filter(f => f.type === 'COMPLIANCE').length,
  }

  if (certStatus === 'APPROVED') {
    return (
      <div role="alert" aria-live="polite" className="bg-gradient-to-r from-economia-success/15 to-economia-guinda/10 border border-economia-success/30 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Award className="h-8 w-8 text-economia-success shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-heading font-bold text-economia-success text-base">Certificado ESG Aprobado</h3>
                {esgScore !== null && esgScore !== undefined && (
                  <span className="text-xs font-bold bg-economia-success/20 text-economia-success px-2 py-0.5 rounded-full">
                    Score {Math.round(esgScore)}%
                  </span>
                )}
              </div>
              {certNotes && (
                <p className="text-foreground/70 text-sm italic mb-2">&ldquo;{certNotes}&rdquo;</p>
              )}
              <p className="text-muted-foreground/60 text-sm">
                {assessedAt ? `Emitido el ${new Date(assessedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Dictamen emitido'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/mi-certificado"
            className="shrink-0 flex items-center gap-2 bg-economia-success hover:bg-economia-success/90 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Ver Certificado
          </Link>
        </div>
      </div>
    )
  }

  if (certStatus === 'REJECTED') {
    return (
      <div role="alert" aria-live="assertive" className="bg-economia-error/10 border border-economia-error/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <XCircle className="h-6 w-6 text-economia-error shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-heading font-semibold text-economia-error text-sm mb-2">Dictamen: No aprobado</h3>
            {certNotes && <p className="text-foreground/70 text-sm italic mb-2">&ldquo;{certNotes}&rdquo;</p>}
            {findingsSummary.nc > 0 && (
              <p className="text-muted-foreground text-xs">{findingsSummary.nc} no conformidad{findingsSummary.nc !== 1 ? 'es' : ''} identificada{findingsSummary.nc !== 1 ? 's' : ''}</p>
            )}
            <p className="text-muted-foreground/60 text-xs mt-1">Contacta a tu Assessor ESG para orientación.</p>
          </div>
        </div>
      </div>
    )
  }

  // IN_REVIEW or CAPA_OPEN
  return (
    <div className="bg-economia-warning/10 border border-economia-warning/30 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <MessageSquare className="h-6 w-6 text-economia-warning shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-heading font-semibold text-economia-warning text-sm">
              {certStatus === 'CAPA_OPEN' ? 'Acciones correctivas requeridas' : 'Revisión en curso — feedback del Assessor'}
            </h3>
          </div>
          {certNotes && (
            <p className="text-foreground text-sm italic mb-3 bg-muted rounded-xl px-3 py-2 border-l-2 border-economia-warning/40">
              "{certNotes}"
            </p>
          )}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {findingsSummary.nc > 0 && (
              <span className="bg-economia-error/15 text-economia-error px-2 py-1 rounded-lg font-medium">
                {findingsSummary.nc} No conformidad{findingsSummary.nc !== 1 ? 'es' : ''}
              </span>
            )}
            {findingsSummary.obs > 0 && (
              <span className="bg-economia-warning/15 text-economia-warning px-2 py-1 rounded-lg font-medium">
                {findingsSummary.obs} Observación{findingsSummary.obs !== 1 ? 'es' : ''}
              </span>
            )}
            {findingsSummary.comp > 0 && (
              <span className="bg-economia-success/10 text-economia-success px-2 py-1 rounded-lg font-medium">
                {findingsSummary.comp} Cumplimiento{findingsSummary.comp !== 1 ? 's' : ''}
              </span>
            )}
            {capaOpen > 0 && (
              <Link href="/dashboard/capa"
                className="bg-economia-error/15 text-economia-error px-2 py-1 rounded-lg font-medium hover:bg-economia-error/25 transition-colors flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                {capaOpen} ticket{capaOpen !== 1 ? 's' : ''} CAPA
              </Link>
            )}
          </div>
          {certStatus === 'CAPA_OPEN' && capaOpen > 0 && (
            <Link href="/dashboard/capa" className="mt-3 inline-flex items-center gap-2 text-xs bg-economia-warning text-black font-medium px-3 py-1.5 rounded-lg hover:bg-economia-warning/90 transition-colors">
              Gestionar acciones correctivas <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── COMPANY VIEW ─────────────────────────────────────────────────────────────
function CompanyDashboard({ userName: _userName, stats, recentDocs, companyMeta: _companyMeta, certStats }: Pick<Props, 'userName' | 'stats' | 'recentDocs' | 'companyMeta' | 'certStats'>) {
  const pct = (n: number) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0

  const hasCert = (certStats?.total ?? 0) > 0
  const certApproved = (certStats?.approved ?? 0) > 0
  const capaOpen = certStats?.capaOpen ?? 0

  const certSteps = [
    { n: 1, label: 'Documentos\nSubidos', done: stats.total > 0, active: stats.total === 0 },
    { n: 2, label: 'Análisis IA\nImpulsado por NVIDIA', done: stats.analyzed > 0, active: stats.total > 0 && stats.analyzed === 0 },
    { n: 3, label: 'Revisión\nAssessor ESG', done: hasCert, active: stats.analyzed > 0 && !hasCert },
    { n: 4, label: 'Certificado\nESG Emitido', done: certApproved, active: hasCert && !certApproved },
  ]

  return (
    <div className="flex-1 p-8 space-y-6 overflow-auto bg-[#F5F5F5]/30">
      {/* Breadcrumbs — gob.mx v3 spec: ol.breadcrumb con icon-home */}
      <nav aria-label="Ubicación" className="mb-2">
        <ol className="breadcrumb-gob">
          <li>
            <Link href="/" aria-label="Inicio">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
          </li>
          <li>Mi Certificación</li>
        </ol>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[#1B1B1B] leading-tight mb-2">Panel de Certificación</h1>
          <div className="pleca-dorada" />
          <p className="text-muted-foreground text-sm font-medium">Gestión de cumplimiento ambiental, social y de gobernanza.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/upload" className="btn-gob-primary !px-10 !py-3 flex items-center gap-2">
            <Upload className="h-4 w-4" /> SUBIR DOCUMENTACIÓN
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-5">
          {certStats && <DictamenBanner certStats={certStats} />}

          {capaOpen > 0 && (!certStats?.certStatus || certStats.certStatus === 'DRAFT') && (
            <Link href="/dashboard/capa" className="flex items-center gap-3 bg-economia-warning/10 border border-economia-warning/30 rounded-2xl p-6 hover:border-economia-warning/50 transition-colors shadow-gob">
              <ShieldAlert className="h-6 w-6 text-economia-warning shrink-0" />
              <div className="flex-1">
                <p className="text-economia-warning font-black text-sm uppercase tracking-widest">
                  {capaOpen} ACCIÓN CORRECTIVA {capaOpen !== 1 ? 'S' : ''} PENDIENTE{capaOpen !== 1 ? 'S' : ''}
                </p>
                <p className="text-muted-foreground text-xs font-medium">Tienes hallazgos que requieren atención inmediata. Haz clic para gestionarlos.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-economia-warning shrink-0" />
            </Link>
          )}

          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-gob">
            <div className="flex items-center gap-3 mb-8">
              <div className="pleca-dorada w-1 h-6" />
              <h2 className="text-lg font-heading font-bold text-[#1B1B1B] uppercase tracking-wider">Flujo Institucional</h2>
            </div>
            <div className="flex items-center gap-0">
              {certSteps.map((step, i) => (
                <div key={step.n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center text-sm font-black border-2 mb-3 shadow-sm transition-all",
                      step.done ? "bg-economia-guinda border-economia-guinda text-white" :
                        step.active ? "bg-economia-warning/20 border-economia-warning text-economia-warning animate-pulse" :
                          "bg-muted border-border text-muted-foreground/60"
                    )}>
                      {step.done ? <CheckCircle className="h-6 w-6" /> : step.n}
                    </div>
                    <span className={cn("text-xs text-center font-black leading-tight whitespace-pre-line uppercase tracking-widest",
                      step.done ? "text-economia-guinda" : step.active ? "text-economia-warning" : "text-muted-foreground/60"
                    )}>{step.label}</span>
                  </div>
                  {i < certSteps.length - 1 && (
                    <div className={cn("h-1 w-full mx-2 mb-8 rounded-full",
                      step.done ? "bg-economia-guinda" : "bg-muted"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-economia-guinda rounded-2xl p-6 shadow-gob group hover:scale-[1.02] transition-transform">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/70 text-sm font-bold uppercase tracking-widest">Documentos</span>
                <FileText className="h-5 w-5 text-white/60" />
              </div>
              <div className="text-4xl font-heading font-bold text-white">{stats.total}</div>
              <Link href="/dashboard/documents" className="text-white/80 text-xs mt-4 flex items-center gap-1 hover:text-white font-bold uppercase tracking-tighter">
                Ver Repositorio <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6 shadow-gob group hover:border-economia-guinda/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Analizados</span>
                <div className="h-8 w-8 rounded-lg bg-economia-success/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-economia-success" />
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-foreground">{stats.analyzed}</div>
              <span className="text-muted-foreground/60 text-xs mt-4 block font-medium">Listos para dictamen</span>
            </div>
            <div className={cn("rounded-2xl p-8 shadow-gob group transition-all border", certApproved ? "bg-economia-success/10 border-economia-success/30" : "bg-card border-border")}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn("text-xs font-black uppercase tracking-widest", certApproved ? "text-economia-success" : "text-muted-foreground")}>Sellos ESG</span>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", certApproved ? "bg-economia-success/20" : "bg-muted")}>
                  <Award className={cn("h-5 w-5", certApproved ? "text-economia-success" : "text-muted-foreground/60")} />
                </div>
              </div>
              <div className="text-4xl font-heading font-bold text-foreground">{certStats?.approved ?? 0}</div>
              <span className={cn("text-xs mt-4 block font-medium", certApproved ? "text-economia-success/70" : "text-muted-foreground/60")}>
                {certApproved ? 'Felicidades: Aprobado' : 'Pendiente de emisión'}
              </span>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-gob">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="pleca-dorada w-1 h-6" />
                <h2 className="font-heading font-semibold text-foreground text-base uppercase tracking-wider">Cargas Recientes</h2>
              </div>
              <Link href="/dashboard/documents" className="text-secondary text-xs font-black hover:underline uppercase tracking-widest">Ver repositorio completo →</Link>
            </div>
            {recentDocs.length === 0 ? (
              <div className="text-center py-12">
                <Upload className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-muted-foreground text-sm font-medium mb-6">Aún no has subido documentos.</p>
                <Link href="/dashboard/upload" className="btn-gob-primary !px-8">
                  Subir mi primer documento
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentDocs.map((doc, i) => (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`}
                    className={cn("flex items-center gap-4 p-4 rounded-xl transition-all border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-sm group", i % 2 === 0 ? "bg-muted/60" : "")}>
                    <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center shrink-0 border border-border shadow-sm group-hover:bg-economia-guinda group-hover:border-economia-guinda transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-bold truncate tracking-tight">{doc.name}</p>
                      <p className="text-muted-foreground/70 text-[10px] font-bold uppercase tracking-widest">{new Date(doc.createdAt).toLocaleDateString('es-MX')}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {doc.certStatus && <CertBadge status={doc.certStatus} />}
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-economia-guinda transition-all group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-gob">
            <h2 className="font-heading font-semibold text-foreground text-sm mb-1 uppercase tracking-widest">Integridad IA</h2>
            <p className="text-muted-foreground text-[10px] font-bold uppercase mb-4 tracking-tighter">Estado de procesamiento NVIDIA</p>
            <div className="flex justify-center relative mb-8">
              <DonutChart {...stats} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading font-bold text-4xl text-foreground">{stats.total}</span>
                <span className="text-muted-foreground text-[9px] font-black uppercase tracking-[0.2em]">Total</span>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Analizados', color: 'bg-economia-success', count: stats.analyzed },
                { label: 'Procesando', color: 'bg-economia-warning', count: stats.processing },
                { label: 'Indexados', color: 'bg-economia-info', count: stats.indexed },
                { label: 'Fallidos', color: 'bg-economia-error', count: stats.failed },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', item.color)} />
                  <span className="text-foreground text-xs font-bold flex-1 uppercase tracking-tighter">{item.label}</span>
                  <span className="text-muted-foreground text-xs font-black">{pct(item.count)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="alert-gob-info shadow-sm !px-6 !py-5">
              <div className="flex gap-4">
                <ShieldAlert className="h-6 w-6 text-economia-info shrink-0" />
                <div>
                  <p className="font-black text-xs uppercase tracking-widest mb-1">PROTOCOLO V.L.A.P.</p>
                  <p className="text-[11px] font-medium leading-relaxed opacity-80">Documentación protegida por Verificación, Validación y Auditoría.</p>
                </div>
              </div>
            </div>

            {recentDocs.some(d => d.certStatus === 'APPROVED') && (
              <div className="alert-gob-success shadow-sm !px-6 !py-5">
                <div className="flex gap-4">
                  <Award className="h-6 w-6 text-economia-success shrink-0" />
                  <div>
                    <p className="font-black text-xs uppercase tracking-widest mb-1">DICTAMEN POSITIVO</p>
                    <p className="text-[11px] font-medium leading-relaxed opacity-80">Tienes certificados institucionales aprobados para descarga.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {certApproved ? (
            <Link href="/dashboard/documents" className="block bg-white border border-economia-success/30 rounded-2xl p-6 shadow-gob hover:scale-[1.02] transition-all group">
              <div className="h-12 w-12 rounded-xl bg-economia-success/10 flex items-center justify-center mb-4 group-hover:bg-economia-success/20 transition-colors">
                <Award className="h-6 w-6 text-economia-success" />
              </div>
              <h3 className="font-heading font-black text-[#1B1B1B] text-xs uppercase tracking-widest mb-2">Certificado ESG Activo</h3>
              <p className="text-muted-foreground text-[11px] font-medium mb-4 leading-relaxed">Tu cumplimiento ha sido validado satisfactoriamente por el comité evaluador.</p>
              <span className="text-economia-success text-xs font-black flex items-center gap-1 uppercase tracking-widest group-hover:gap-2 transition-all">
                DESCARGAR SELLOS <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : (
            <div className="bg-gradient-to-br from-economia-guinda to-[#4a0e26] rounded-2xl p-6 shadow-gob relative overflow-hidden group">
              <div className="relative z-10">
                <Award className="h-10 w-10 text-white/40 mb-4" />
                <h3 className="font-heading font-black text-white text-xs uppercase tracking-widest mb-2">Obtén tu Certificación</h3>
                <p className="text-white/70 text-[11px] font-medium mb-6 leading-relaxed">Sube tu evidencia para iniciar el proceso de dictamen institucional.</p>
                <Link href="/dashboard/upload" className="block text-center bg-white text-economia-guinda hover:bg-white/90 text-[11px] font-black py-3 rounded-xl transition-all uppercase tracking-[0.2em]">
                  SUBIR EVIDENCIA
                </Link>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                <Award className="h-32 w-32 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ASSESSOR VIEW ─────────────────────────────────────────────────────────────
function AssessorDashboard({ userName: _userName, globalStats, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allDocsGlobal'>) {
  const queue = allDocsGlobal.filter(d => d.status === 'ANALYZED' || d.status === 'INDEXED')

  const quickActions = [
    { href: '/dashboard/queue', label: 'Cola de Revisión', icon: ClipboardList, color: 'text-economia-warning', bg: 'bg-economia-warning/10', border: 'border-economia-warning/20', count: queue.length },
    { href: '/dashboard/companies', label: 'Empresas Asignadas', icon: Building2, color: 'text-economia-info', bg: 'bg-economia-info/10', border: 'border-economia-info/20', count: null },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert, color: 'text-economia-error', bg: 'bg-economia-error/10', border: 'border-economia-error/20', count: globalStats.capaOpen },
    { href: '/dashboard/graph', label: 'Grafo Global', icon: Network, color: 'text-economia-success', bg: 'bg-economia-success/10', border: 'border-economia-success/20', count: null },
  ]

  return (
    <div className="flex-1 p-8 space-y-6 overflow-auto bg-[#F5F5F5]/30">
      {/* Breadcrumbs — gob.mx v3 spec: ol.breadcrumb-gob con icon-home */}
      <nav aria-label="Ubicación" className="mb-2">
        <ol className="breadcrumb-gob">
          <li>
            <Link href="/" aria-label="Inicio">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
          </li>
          <li>Revisión Técnica</li>
        </ol>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[#1B1B1B] leading-tight mb-2">Consola del Assessor</h1>
          <div className="pleca-dorada" />
          <p className="text-muted-foreground text-sm font-medium">Validación de expedientes y emisión de dictámenes institucionales.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/queue" className="btn-gob-primary !px-10 !py-3">
            IR A COLA DE REVISIÓN
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div className="col-span-2 space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-economia-warning/10 border border-economia-warning/30 rounded-2xl p-6 shadow-gob">
              <div className="flex items-center justify-between mb-3">
                <span className="text-economia-warning text-xs font-bold uppercase">Por Revisar</span>
                <ClipboardList className="h-5 w-5 text-economia-warning" aria-hidden="true" />
              </div>
              <div className="text-4xl font-heading font-black text-foreground">{queue.length}</div>
              <span className="text-economia-warning/60 text-xs mt-1 block">En cola de dictamen</span>
            </div>
            <div className="bg-economia-success/10 border border-economia-success/30 rounded-2xl p-6 shadow-gob">
              <div className="flex items-center justify-between mb-3">
                <span className="text-economia-success text-xs font-bold uppercase">Aprobados</span>
                <CheckCircle className="h-5 w-5 text-economia-success" aria-hidden="true" />
              </div>
              <div className="text-4xl font-heading font-black text-foreground">{globalStats.approved}</div>
              <span className="text-economia-success/60 text-xs mt-1 block">Sellos emitidos</span>
            </div>
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-gob">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground text-xs font-bold uppercase">Empresas</span>
                <Building2 className="h-5 w-5 text-economia-info" aria-hidden="true" />
              </div>
              <div className="text-4xl font-heading font-black text-foreground">{globalStats.users}</div>
              <span className="text-muted-foreground text-xs mt-1 block">Participantes</span>
            </div>
            <div className={cn("rounded-2xl p-6 border shadow-gob", globalStats.capaOpen > 0 ? "bg-economia-error/10 border-economia-error/30" : "bg-card border-border/60")}>
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-xs font-bold uppercase", globalStats.capaOpen > 0 ? "text-economia-error" : "text-muted-foreground")}>CAPA Abiertos</span>
                <ShieldAlert className={cn("h-5 w-5", globalStats.capaOpen > 0 ? "text-economia-error" : "text-muted-foreground/60")} aria-hidden="true" />
              </div>
              <div className="text-4xl font-heading font-black text-foreground">{globalStats.capaOpen}</div>
              <span className="text-muted-foreground text-xs mt-1 block">Feedback pendiente</span>
            </div>
          </div>

          {/* Cola de revisión */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-gob">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading font-semibold text-foreground text-sm">Cola de Revisión</h2>
                <p className="text-muted-foreground/60 text-xs">Documentos analizados por IA listos para dictamen</p>
              </div>
              <Link href="/dashboard/queue" className="text-economia-guinda text-xs hover:underline flex items-center gap-1">
                Ver cola completa <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {queue.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-economia-success/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Cola vacía — sin documentos pendientes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.slice(0, 5).map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border">
                    <div className="h-8 w-8 bg-economia-warning/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-economia-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-muted-foreground/70 text-[10px]">
                        {doc.user.companyName || doc.user.name || doc.user.email}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                    <Link
                      href={`/dashboard/review/company/${doc.userId}`}
                      className="flex items-center gap-1 text-xs bg-economia-warning hover:bg-economia-warning/90 text-black font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
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
          <div className="bg-card border border-border rounded-2xl p-6 shadow-gob">
            <h2 className="font-heading font-semibold text-foreground text-sm mb-3">Acciones Rápidas</h2>
            <div className="space-y-2">
              {quickActions.map(action => {
                const Icon = action.icon
                return (
                  <Link key={action.href} href={action.href}
                    className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-muted font-heading font-black text-xs uppercase tracking-widest", action.border, "border-opacity-30")}
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", action.bg)}>
                      <Icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <span className="text-foreground flex-1">{action.label}</span>
                    {action.count !== null && action.count > 0 && (
                      <span className={cn("font-bold px-2 py-0.5 rounded-full", action.bg, action.color)}>
                        {action.count}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-gob">
            <h2 className="font-heading font-semibold text-foreground text-sm mb-4">Actividad Reciente</h2>
            <div className="space-y-3">
              {allDocsGlobal.slice(0, 6).map(doc => {
                const certStatus = doc.certifications[0]?.status
                return (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="flex items-start gap-2 hover:opacity-80 transition-opacity">
                    <div className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                      certStatus === 'APPROVED' ? 'bg-economia-success' :
                        certStatus === 'REJECTED' ? 'bg-economia-error' :
                          doc.status === 'ANALYZED' ? 'bg-economia-info' :
                            doc.status === 'PROCESSING' ? 'bg-economia-warning' : 'bg-economia-gris'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-xs font-medium truncate">{doc.name}</p>
                      <p className="text-muted-foreground/70 text-[10px]">{doc.user.companyName || doc.user.name || doc.user.email}</p>
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
function AdminDashboard({ userName: _userName, globalStats, allUsers, allDocsGlobal }: Pick<Props, 'userName' | 'globalStats' | 'allUsers' | 'allDocsGlobal'>) {
  const kpis = [
    { label: 'Empresas', value: globalStats.users, color: 'text-economia-success', icon: Building2, bg: 'bg-economia-success/10', href: '/dashboard/companies' },
    { label: 'Documentos', value: globalStats.total, color: 'text-economia-info', icon: FileText, bg: 'bg-economia-info/10', href: '/dashboard/documents' },
    { label: 'Certificados ESG', value: globalStats.approved, color: 'text-economia-guinda', icon: Award, bg: 'bg-economia-guinda/10', href: '/dashboard/documents' },
    { label: 'CAPA Abiertos', value: globalStats.capaOpen, color: 'text-economia-warning', icon: ShieldAlert, bg: 'bg-economia-warning/10', href: '/dashboard/capa' },
    { label: 'IA Analizados', value: globalStats.analyzed, color: 'text-foreground', icon: CheckCircle, bg: 'bg-muted', href: '/dashboard/documents' },
  ]

  const adminActions = [
    { href: '/dashboard/companies', label: 'Gestionar Empresas', icon: Building2, color: 'text-economia-info' },
    { href: '/dashboard/assessors', label: 'Ver Assessors', icon: Users, color: 'text-economia-success' },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert, color: 'text-economia-warning' },
    { href: '/dashboard/logs', label: 'Logs de Auditoría', icon: ScrollText, color: 'text-muted-foreground' },
    { href: '/api/export/documents', label: 'Exportar CSV', icon: Download, color: 'text-economia-guinda', external: true },
    { href: '/dashboard/graph', label: 'Grafo Global', icon: Network, color: 'text-economia-success' },
  ]

  return (
    <div className="flex-1 p-8 space-y-6 overflow-auto bg-[#F5F5F5]/30">
      {/* Breadcrumbs — gob.mx v3 spec: ol.breadcrumb-gob con icon-home */}
      <nav aria-label="Ubicación" className="mb-2">
        <ol className="breadcrumb-gob">
          <li>
            <Link href="/" aria-label="Inicio">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </Link>
          </li>
          <li>Dashboard</li>
        </ol>
      </nav>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-[#1B1B1B] leading-tight mb-2">Expediente Empresarial</h1>
          <div className="pleca-dorada" />
          <p className="text-muted-foreground text-sm font-medium">Gestión integral de cumplimiento normativo y activos digitales.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 bg-white border border-border/60 shadow-sm px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            <Download className="h-4 w-4" aria-hidden="true" /> Exportar Reporte
          </button>
          <Link href="/dashboard/upload" className="btn-gob-primary !px-8 !py-3 flex items-center gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" /> Cargar Documento
          </Link>
        </div>
      </div>

      {/* Métricas e Indicadores */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="pleca-dorada w-1 h-6" />
          <h2 className="text-lg font-heading font-bold text-[#1B1B1B] uppercase tracking-wider">Estado de Cumplimiento</h2>
        </div>
        <div className="grid grid-cols-5 gap-6">
          {kpis.map(kpi => {
            const Icon = kpi.icon
            return (
              <Link key={kpi.label} href={kpi.href} className="bg-card border border-border/60 rounded-2xl p-6 shadow-gob hover:border-economia-guinda/30 transition-all">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center mb-4", kpi.bg)}>
                  <Icon className={cn("h-5 w-5", kpi.color)} />
                </div>
                <div className={cn("text-3xl font-heading font-black", kpi.color)}>{kpi.value}</div>
                <p className="text-muted-foreground text-xs font-bold mt-1 uppercase tracking-wider">{kpi.label}</p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Stack NVIDIA — visible solo para Admin */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#0d1b2a] border border-[#76b900]/20 rounded-2xl p-5 shadow-gob">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-[#76b900]/20 flex items-center justify-center shrink-0">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#76b900"><path d="M9 3L3 9v12h6V9h6V3H9zm6 6v12h6V9h-6z" /></svg>
          </div>
          <div>
            <h2 className="font-heading font-semibold text-white text-sm">Stack Tecnológico NVIDIA</h2>
            <p className="text-white/60 text-[10px]">Modelos y APIs activos en la plataforma</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'NVIDIA NIM', role: 'API de inferencia', desc: 'Orquesta todos los modelos de lenguaje vía NVIDIA Inference Microservices', badge: 'Infraestructura', color: 'border-[#76b900]/30 bg-[#76b900]/5' },
            { name: 'Llama 3.1 · 70B', role: 'Procesamiento de documentos', desc: 'Extracción de estructura, entidades y relaciones de los PDFs analizados', badge: 'Procesamiento', color: 'border-economia-info/30 bg-economia-info/5' },
            { name: 'Qwen 3.5 · 122B', role: 'Motor Q&A', desc: 'Generación de respuestas en streaming para consultas sobre documentos', badge: 'Q&A', color: 'border-economia-success/30 bg-economia-success/5' },
          ].map(item => (
            <div key={item.name} className={`rounded-xl border p-4 ${item.color}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-heading font-bold text-white text-sm">{item.name}</span>
                <span className="text-[9px] font-semibold text-[#76b900] bg-[#76b900]/10 px-1.5 py-0.5 rounded-full shrink-0">{item.badge}</span>
              </div>
              <p className="text-white/70 text-[10px] font-medium mb-1">{item.role}</p>
              <p className="text-white/50 text-[10px] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Acciones administrativas */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-gob">
        <div className="flex items-center gap-3 mb-6">
          <div className="pleca-dorada w-1 h-6" />
          <h2 className="font-heading font-semibold text-foreground text-base uppercase tracking-wider">Acciones Administrativas</h2>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {adminActions.map(action => {
            const Icon = action.icon
            const content = (
              <div className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/60 hover:border-economia-guinda/30 hover:bg-muted/40 transition-all text-center group">
                <Icon className={cn("h-6 w-6 group-hover:scale-110 transition-transform", action.color)} />
                <span className="text-muted-foreground text-xs font-medium leading-tight">{action.label}</span>
              </div>
            )
            return action.external
              ? <a key={action.href} href={action.href} target="_blank">{content}</a>
              : <Link key={action.href} href={action.href}>{content}</Link>
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-10">
        {/* Empresas Registradas */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-gob">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="pleca-dorada w-1 h-6" />
              <h2 className="font-heading font-semibold text-foreground text-base uppercase tracking-wider">Empresas Registradas</h2>
            </div>
            <Link href="/dashboard/companies" className="text-secondary text-xs font-black hover:underline uppercase tracking-widest">Gestionar →</Link>
          </div>
          <div className="space-y-1">
            {allUsers.slice(0, 10).map((user, i) => (
              <div key={user.id} className={cn("flex items-center gap-4 p-3 rounded-lg transition-colors border border-transparent", i % 2 === 0 ? "bg-muted/60" : "")}>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  <span className="text-xs font-black text-primary">
                    {(user.companyName || user.name || user.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-bold truncate">{user.companyName || user.name || user.email}</p>
                  <p className="text-muted-foreground/70 text-[10px] uppercase font-bold tracking-tighter truncate">{user.email}</p>
                </div>
                <span className="text-economia-info text-[10px] font-black bg-economia-info/10 px-3 py-1 rounded-full shrink-0 border border-economia-info/20">
                  {user._count.documents} DOCS
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad Global */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-gob">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="pleca-dorada w-1 h-6" />
              <h2 className="font-heading font-semibold text-foreground text-base uppercase tracking-wider">Actividad Global</h2>
            </div>
            <Link href="/dashboard/documents" className="text-secondary text-xs font-black hover:underline uppercase tracking-widest">Ver todo →</Link>
          </div>
          <div className="space-y-1">
            {allDocsGlobal.slice(0, 10).map((doc, i) => {
              const certStatus = doc.certifications[0]?.status
              return (
                <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className={cn("flex items-center gap-4 p-3 rounded-lg transition-all border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-sm", i % 2 === 0 ? "bg-muted/60" : "")}>
                  <div className={cn("h-2 w-2 rounded-full shrink-0",
                    certStatus === 'APPROVED' ? 'bg-economia-success' :
                      certStatus === 'REJECTED' ? 'bg-economia-error' :
                        doc.status === 'ANALYZED' ? 'bg-economia-info' :
                          doc.status === 'PROCESSING' ? 'bg-economia-warning' : 'bg-economia-gris'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-muted-foreground/60 text-[10px] uppercase tracking-tighter truncate">{doc.user.companyName || doc.user.name || doc.user.email}</p>
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
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export function DashboardView(props: Props) {
  const { role } = useRole()
  const router = useRouter()

  // Company dashboard: poll every 15s to pick up dictamen/CAPA updates from assessor
  useEffect(() => {
    if (role !== 'company') return
    const id = setInterval(() => router.refresh(), 15000)
    return () => clearInterval(id)
  }, [role, router])

  if (role === 'assessor') return <AssessorDashboard userName={props.userName} globalStats={props.globalStats} allDocsGlobal={props.allDocsGlobal} />
  if (role === 'admin') return <AdminDashboard userName={props.userName} globalStats={props.globalStats} allUsers={props.allUsers} allDocsGlobal={props.allDocsGlobal} />
  return <CompanyDashboard userName={props.userName} stats={props.stats} recentDocs={props.recentDocs} companyMeta={props.companyMeta} certStats={props.certStats} />
}
