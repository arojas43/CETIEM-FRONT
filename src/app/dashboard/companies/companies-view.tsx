"use client";

import { useState } from "react";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import {
  Building2, FileText, Eye, Search, ChevronDown, ChevronRight,
  CheckCircle, Clock, AlertCircle, RefreshCw, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Doc { id: string; name: string; status: string; domain: string; createdAt: Date }
interface User { id: string; name: string | null; email: string; createdAt: Date; documents: Doc[] }

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "text-cetiem-gray  bg-cetiem-gray/10",
  PROCESSING: "text-cetiem-amber bg-cetiem-amber/10",
  INDEXED:    "text-cetiem-teal  bg-cetiem-teal/10",
  ANALYZED:   "text-cetiem-lime  bg-cetiem-lime/10",
  FAILED:     "text-cetiem-red   bg-cetiem-red/10",
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente", PROCESSING: "Procesando", INDEXED: "Indexado", ANALYZED: "Analizado", FAILED: "Fallido",
}

export function CompaniesView({ users }: { users: User[] }) {
  const { role } = useRole();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = users.filter(u =>
    (u.name?.toLowerCase().includes(search.toLowerCase()) ||
     u.email.toLowerCase().includes(search.toLowerCase()))
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
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Empresas",       value: users.length,                                                    color: "text-white", icon: Building2  },
            { label: "Listas para dictamen", value: users.filter(u => certStatus(u.documents) === "READY").length,      color: "text-cetiem-lime",  icon: CheckCircle },
            { label: "En proceso",           value: users.filter(u => certStatus(u.documents) === "IN_PROGRESS").length, color: "text-cetiem-amber", icon: RefreshCw   },
            { label: "Sin documentos",       value: users.filter(u => certStatus(u.documents) === "NO_DOCS").length,    color: "text-cetiem-gray",  icon: Users       },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-cetiem-card border border-white/5 rounded-2xl p-4">
                <Icon className={cn("h-5 w-5 mb-2", stat.color)} />
                <div className={cn("text-2xl font-heading font-bold", stat.color)}>{stat.value}</div>
                <p className="text-cetiem-gray/60 text-[10px] mt-0.5">{stat.label}</p>
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

            return (
              <div key={user.id} className="bg-cetiem-card border border-white/5 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : user.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-cetiem-green/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-cetiem-green">
                      {(user.name || user.email)[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{user.name || user.email}</p>
                    <p className="text-cetiem-gray/50 text-xs truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-cetiem-gray text-xs">{user.documents.length} doc{user.documents.length !== 1 ? "s" : ""}</span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border", badge.color)}>
                      <BadgeIcon className="h-2.5 w-2.5" />
                      {badge.label}
                    </span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-cetiem-gray" /> : <ChevronRight className="h-4 w-4 text-cetiem-gray" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/5 p-4 pt-3 bg-white/2">
                    <p className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest mb-3">
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
                            <div className="flex items-center gap-1">
                              <Link href={`/dashboard/documents/${doc.id}`}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-cetiem-gray hover:text-white transition-colors" title="Ver documento">
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                              {(doc.status === "ANALYZED" || doc.status === "INDEXED") && (
                                <Link href={`/dashboard/review/${doc.id}`}
                                  className="flex items-center gap-1 px-2 py-1 bg-cetiem-amber hover:bg-cetiem-amber/90 text-black text-[10px] font-bold rounded-lg transition-colors">
                                  Revisar
                                </Link>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
