"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  Building2, FileText, Eye, Search, ChevronDown, ChevronRight,
  CheckCircle, Clock, AlertCircle, RefreshCw, Users, XCircle,
  UserCheck, Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Doc {
  id: string; name: string; status: string; domain: string; createdAt: Date;
  certifications: { id: string; status: string; esgScore: number | null }[];
}
interface CompanyCert { id: string; status: string; esgScore: number | null; createdAt: Date }
interface Assessor { id: string; name: string | null; email: string }
interface User {
  id: string; name: string | null; email: string; createdAt: Date;
  companyName: string | null; track: string | null; sprintLevel: string;
  assessorId: string | null; documents: Doc[];
  companyCertifications: CompanyCert[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "text-cetiem-gray  bg-cetiem-gray/10",
  PROCESSING: "text-cetiem-amber bg-cetiem-amber/10",
  INDEXED:    "text-cetiem-teal  bg-cetiem-teal/10",
  ANALYZED:   "text-cetiem-lime  bg-cetiem-lime/10",
  FAILED:     "text-cetiem-red   bg-cetiem-red/10",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", PROCESSING: "Procesando", INDEXED: "Indexado", ANALYZED: "Analizado", FAILED: "Fallido",
};
const CERT_STATUS_COLOR: Record<string, string> = {
  APPROVED:  "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/20",
  IN_REVIEW: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20",
  REJECTED:  "text-cetiem-red bg-cetiem-red/10 border-cetiem-red/20",
  REVOKED:   "text-cetiem-red/60 bg-cetiem-red/5 border-cetiem-red/10",
  CAPA_OPEN: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20",
};
const TRACK_COLOR: Record<string, string> = {
  A: "text-cetiem-teal bg-cetiem-teal/10 border-cetiem-teal/20",
  B: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20",
  C: "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/20",
};
const TRACK_LABEL: Record<string, string> = {
  A: "Track A · Industria",
  B: "Track B · Construcción",
  C: "Track C · Tecnología",
};
const SPRINT_LABEL: Record<string, string> = {
  STARTUP: "Sprint 1 — Startup",
  PEQUENA: "Sprint 2 — Pequeña",
  MEDIANA: "Sprint 3 — Mediana",
};

export function CompaniesView({ users, assessors }: { users: User[]; assessors: Assessor[] }) {
  const { role } = useRole();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [localAssessors, setLocalAssessors] = useState<Record<string, string | null>>(
    Object.fromEntries(users.map(u => [u.id, u.assessorId]))
  );

  const filtered = users.filter(u =>
    (u.companyName || u.name || u.email).toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const certStatus = (docs: Doc[]) => {
    if (docs.some(d => d.status === "FAILED")) return "ISSUE";
    if (docs.some(d => d.status === "ANALYZED")) return "READY";
    if (docs.some(d => d.status === "PROCESSING" || d.status === "INDEXED")) return "IN_PROGRESS";
    if (docs.length === 0) return "NO_DOCS";
    return "PENDING";
  };

  const certBadge: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    READY:       { label: "Listo para dictamen",  color: "text-cetiem-lime  bg-cetiem-lime/10  border-cetiem-lime/20",  icon: CheckCircle },
    IN_PROGRESS: { label: "Análisis IA en curso", color: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20", icon: RefreshCw   },
    PENDING:     { label: "Pendiente de subida",  color: "text-cetiem-gray  bg-white/5         border-white/10",        icon: Clock       },
    NO_DOCS:     { label: "Sin documentos",       color: "text-cetiem-gray/50 bg-white/3       border-white/5",         icon: AlertCircle },
    ISSUE:       { label: "Con errores",          color: "text-cetiem-red   bg-cetiem-red/10   border-cetiem-red/20",   icon: AlertCircle },
  };

  const handleAssign = async (companyId: string, assessorId: string | null) => {
    setAssigningId(companyId);
    try {
      const res = await fetch(`/api/companies/${companyId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessorId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al asignar assessor.");
        return;
      }
      setLocalAssessors(prev => ({ ...prev, [companyId]: assessorId }));
      router.refresh(); // re-fetch server data (companyCertifications, dictamen badges)
    } catch {
      alert("Error de conexión al asignar assessor.");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">
            {role === "admin" ? "Gestión de Empresas" : "Empresas Asignadas"}
          </h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {filtered.length} empresa{filtered.length !== 1 ? "s" : ""} registrada{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-cetiem-card border border-white/10 rounded-xl px-3 py-2 w-64">
          <Search className="h-4 w-4 text-cetiem-gray shrink-0" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa..."
            className="bg-transparent text-sm text-white placeholder-cetiem-gray/40 outline-none w-full"
          />
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: "Total Empresas",       value: users.length,                                                    color: "text-white",        icon: Building2 },
            { label: "Track A — Industria",  value: users.filter(u => u.track === "A").length,                      color: "text-cetiem-teal",  icon: Building2 },
            { label: "Track B — Construcción",value: users.filter(u => u.track === "B").length,                     color: "text-cetiem-amber", icon: Building2 },
            { label: "Track C — Tecnología", value: users.filter(u => u.track === "C").length,                      color: "text-cetiem-lime",  icon: Building2 },
            { label: "Sin assessor",         value: users.filter(u => !localAssessors[u.id]).length,                color: "text-cetiem-red",   icon: Users     },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-cetiem-card border border-white/5 rounded-2xl p-4">
                <Icon className={cn("h-4 w-4 mb-2", stat.color)} />
                <div className={cn("text-2xl font-heading font-bold", stat.color)}>{stat.value}</div>
                <p className="text-cetiem-gray/60 text-[10px] mt-0.5 leading-tight">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Companies list */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-cetiem-gray/20 mx-auto mb-3" />
              <p className="text-cetiem-gray">No se encontraron empresas</p>
            </div>
          )}
          {filtered.map(user => {
            const cs = certStatus(user.documents);
            const badge = certBadge[cs];
            const BadgeIcon = badge.icon;
            const isOpen = expanded === user.id;
            const assignedAssessorId = localAssessors[user.id];
            const assignedAssessor = assessors.find(a => a.id === assignedAssessorId);
            const companyCert = user.companyCertifications[0] ?? null;

            return (
              <div key={user.id} className="bg-cetiem-card border border-white/5 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : user.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-cetiem-green/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-cetiem-green">
                      {(user.companyName || user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{user.companyName || user.name || user.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-cetiem-gray/50 text-xs truncate">{user.email}</p>
                      {user.track && (
                        <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", TRACK_COLOR[user.track])}>
                          {TRACK_LABEL[user.track]}
                        </span>
                      )}
                      <span className="text-[9px] text-cetiem-gray/40">{SPRINT_LABEL[user.sprintLevel] || user.sprintLevel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {assignedAssessor ? (
                      <span className="flex items-center gap-1 text-[10px] text-cetiem-teal bg-cetiem-teal/10 px-2 py-1 rounded-full">
                        <UserCheck className="h-2.5 w-2.5" /> {assignedAssessor.name || assignedAssessor.email}
                      </span>
                    ) : (
                      <span className="text-[10px] text-cetiem-red/60 bg-cetiem-red/5 px-2 py-1 rounded-full">Sin assessor</span>
                    )}
                    <span className="text-cetiem-gray text-xs">{user.documents.length} doc{user.documents.length !== 1 ? "s" : ""}</span>
                    {/* Dictamen a nivel empresa */}
                    {companyCert ? (
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border", CERT_STATUS_COLOR[companyCert.status] || "text-cetiem-gray bg-white/5 border-white/10")}>
                        <Award className="h-2.5 w-2.5" />
                        {companyCert.status === "APPROVED" ? `Aprobada${companyCert.esgScore != null ? ` · ${Math.round(companyCert.esgScore)}%` : ""}` :
                         companyCert.status === "REJECTED"  ? "Rechazada" :
                         companyCert.status === "CAPA_OPEN" ? "CAPA Abierta" :
                         companyCert.status === "IN_REVIEW" ? "En revisión" : companyCert.status}
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border", badge.color)}>
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badge.label}
                      </span>
                    )}
                    {isOpen ? <ChevronDown className="h-4 w-4 text-cetiem-gray" /> : <ChevronRight className="h-4 w-4 text-cetiem-gray" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 p-4 space-y-4 bg-white/2">

                    {/* Assessor assignment (admin only) */}
                    {role === "admin" && (
                      <div className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-xl p-3">
                        <UserCheck className="h-4 w-4 text-cetiem-teal shrink-0" />
                        <span className="text-xs text-white font-medium">Assessor asignado</span>
                        <select
                          value={assignedAssessorId || ""}
                          onChange={e => handleAssign(user.id, e.target.value || null)}
                          disabled={assigningId === user.id}
                          className="flex-1 h-7 px-2 text-xs bg-cetiem-card border border-white/10 rounded-lg text-white focus:outline-none focus:border-cetiem-teal disabled:opacity-50"
                        >
                          <option value="">— Sin asignar —</option>
                          {assessors.map(a => (
                            <option key={a.id} value={a.id}>{a.name || a.email}</option>
                          ))}
                        </select>
                        {assigningId === user.id && <RefreshCw className="h-3.5 w-3.5 text-cetiem-gray animate-spin" />}
                      </div>
                    )}

                    {/* Dictamen a nivel empresa */}
                    <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-cetiem-amber shrink-0" />
                        <span className="text-xs text-white font-medium">Dictamen ESG</span>
                        {companyCert && (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", CERT_STATUS_COLOR[companyCert.status] || "text-cetiem-gray bg-white/5 border-white/10")}>
                            {companyCert.status === "APPROVED" ? `Aprobada · ${companyCert.esgScore != null ? Math.round(companyCert.esgScore)+"%" : ""}` :
                             companyCert.status === "REJECTED"  ? "Rechazada" :
                             companyCert.status === "CAPA_OPEN" ? "CAPA Abierta" :
                             companyCert.status === "IN_REVIEW" ? "En revisión" : companyCert.status}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/review/company/${user.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cetiem-amber hover:bg-cetiem-amber/90 text-black text-[10px] font-bold rounded-lg transition-colors"
                      >
                        {companyCert ? "Ver / Modificar Dictamen" : "Emitir Dictamen"}
                      </Link>
                    </div>

                    {/* Documents */}
                    <div>
                      <p className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest mb-2">
                        Documentos ({user.documents.length})
                      </p>
                      {user.documents.length === 0 ? (
                        <p className="text-cetiem-gray/40 text-xs py-3 text-center">Esta empresa aún no ha subido documentos.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {user.documents.map(doc => (
                            <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                              <FileText className="h-4 w-4 text-cetiem-gray/50 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-medium truncate">{doc.name}</p>
                                <p className="text-cetiem-gray/40 text-[10px] capitalize">{doc.domain?.toLowerCase()} · {new Date(doc.createdAt).toLocaleDateString("es-MX")}</p>
                              </div>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[doc.status])}>
                                {STATUS_LABEL[doc.status]}
                              </span>
                              <Link href={`/dashboard/documents/${doc.id}`}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-cetiem-gray hover:text-white transition-colors" title="Ver documento">
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
