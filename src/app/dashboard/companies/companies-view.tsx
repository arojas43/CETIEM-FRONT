"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  Building2, FileText, Eye, Search, ChevronDown, ChevronRight,
  CheckCircle, Clock, AlertCircle, RefreshCw, Users, XCircle,
  UserCheck, Award, ChevronLeft,
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
interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
  hasMore: boolean; hasPrev: boolean;
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

const certDocStatus = (docs: Doc[]) => {
  if (docs.some(d => d.status === "FAILED")) return "ISSUE";
  if (docs.some(d => d.status === "ANALYZED")) return "READY";
  if (docs.some(d => d.status === "PROCESSING" || d.status === "INDEXED")) return "IN_PROGRESS";
  if (docs.length === 0) return "NO_DOCS";
  return "PENDING";
};
const certBadge: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  READY:       { label: "Listo para dictamen",  color: "text-cetiem-lime  bg-cetiem-lime/10  border-cetiem-lime/20",   icon: CheckCircle },
  IN_PROGRESS: { label: "Análisis IA en curso", color: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20", icon: RefreshCw   },
  PENDING:     { label: "Pendiente de subida",  color: "text-cetiem-gray  bg-white/5         border-white/10",         icon: Clock       },
  NO_DOCS:     { label: "Sin documentos",       color: "text-cetiem-gray/50 bg-white/3       border-white/5",          icon: AlertCircle },
  ISSUE:       { label: "Con errores",          color: "text-cetiem-red   bg-cetiem-red/10   border-cetiem-red/20",    icon: AlertCircle },
};

export function CompaniesView({ assessors }: { assessors: Assessor[] }) {
  const { role } = useRole();
  const router = useRouter();

  const [users, setUsers]           = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [fetchError, setFetchError]   = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [localAssessors, setLocalAssessors] = useState<Record<string, string | null>>({});

  // Debounce search — reset to page 1 when search changes
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/companies?${params}`);
      if (!res.ok) { setFetchError(true); return; }
      const json = await res.json();
      setUsers(json.data);
      setPagination(json.pagination);
      setLocalAssessors(prev => {
        const next = { ...prev };
        for (const u of json.data) if (!(u.id in next)) next[u.id] = u.assessorId;
        return next;
      });
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

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
      router.refresh();
    } catch {
      alert("Error de conexión al asignar assessor.");
    } finally {
      setAssigningId(null);
    }
  };

  const total = pagination?.total ?? 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">
            {role === "admin" ? "Gestión de Empresas" : "Empresas Asignadas"}
          </h1>
          <p className="text-cetiem-gray text-sm mt-0.5">
            {loading ? "Cargando…" : `${total} empresa${total !== 1 ? "s" : ""} registrada${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-cetiem-card border border-white/10 rounded-xl px-3 py-2 w-64">
          <Search className="h-4 w-4 text-cetiem-gray shrink-0" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa..."
            className="bg-transparent text-sm text-white placeholder-cetiem-gray/40 outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-cetiem-gray/40 hover:text-white">
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-cetiem-card border border-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && fetchError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="h-10 w-10 text-cetiem-red/30" />
            <p className="text-cetiem-gray text-sm">Error al cargar las empresas.</p>
            <button onClick={() => fetchCompanies()}
              className="text-sm border border-white/10 hover:border-cetiem-green/30 text-cetiem-gray hover:text-white px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
          </div>
        )}

        {/* Companies list */}
        {!loading && !fetchError && (
          <>
            {users.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-cetiem-gray/20 mx-auto mb-3" />
                <p className="text-cetiem-gray">{debouncedSearch ? "Sin resultados para esa búsqueda" : "No hay empresas registradas"}</p>
              </div>
            )}
            <div className="space-y-2">
              {users.map(user => {
                const cs = certDocStatus(user.documents);
                const badge = certBadge[cs];
                const BadgeIcon = badge.icon;
                const isOpen = expanded === user.id;
                const assignedAssessorId = localAssessors[user.id] ?? user.assessorId;
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
                        {companyCert ? (
                          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border", CERT_STATUS_COLOR[companyCert.status] || "text-cetiem-gray bg-white/5 border-white/10")}>
                            <Award className="h-2.5 w-2.5" />
                            {companyCert.status === "APPROVED"  ? `Aprobada${companyCert.esgScore != null ? ` · ${Math.round(companyCert.esgScore)}%` : ""}` :
                             companyCert.status === "REJECTED"   ? "Rechazada" :
                             companyCert.status === "CAPA_OPEN"  ? "CAPA Abierta" :
                             companyCert.status === "IN_REVIEW"  ? "En revisión" : companyCert.status}
                          </span>
                        ) : (
                          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border", badge.color)}>
                            <BadgeIcon className="h-2.5 w-2.5" /> {badge.label}
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

                        {/* Dictamen */}
                        <div className="flex items-center justify-between bg-white/3 border border-white/5 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-cetiem-amber shrink-0" />
                            <span className="text-xs text-white font-medium">Dictamen ESG</span>
                            {companyCert && (
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", CERT_STATUS_COLOR[companyCert.status] || "text-cetiem-gray bg-white/5 border-white/10")}>
                                {companyCert.status === "APPROVED"  ? `Aprobada · ${companyCert.esgScore != null ? Math.round(companyCert.esgScore)+"%" : ""}` :
                                 companyCert.status === "REJECTED"   ? "Rechazada" :
                                 companyCert.status === "CAPA_OPEN"  ? "CAPA Abierta" :
                                 companyCert.status === "IN_REVIEW"  ? "En revisión" : companyCert.status}
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

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-6">
                <p className="text-xs text-cetiem-gray">
                  Pág {pagination.page} de {pagination.totalPages} · {pagination.total} empresas
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)} disabled={!pagination.hasPrev}
                    className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4)) + i;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={cn(
                          "text-xs w-8 h-8 rounded-lg border transition-colors",
                          p === pagination.page
                            ? "bg-cetiem-green/20 border-cetiem-green/40 text-cetiem-green font-bold"
                            : "border-white/10 text-cetiem-gray hover:text-white hover:border-white/20"
                        )}
                      >{p}</button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => p + 1)} disabled={!pagination.hasMore}
                    className="flex items-center gap-1 text-xs border border-white/10 hover:border-cetiem-green/40 text-cetiem-gray hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
                  >
                    Siguiente <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
