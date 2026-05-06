"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Clock, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/role-context";

interface CapaTicket {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED" | "OVERDUE";
  dueDate: string;
  resolution: string | null;
  closedAt: string | null;
  createdAt: string;
  document: { id: string; name: string };
  finding: { type: string; severity: string; title: string } | null;
  user: { name: string | null; email: string; companyName: string | null };
}

const STATUS_CONFIG = {
  OPEN: { label: "Abierto", color: "text-economia-warning bg-economia-warning/10 border-economia-warning/20", icon: Clock },
  IN_PROGRESS: { label: "En proceso", color: "text-economia-info bg-economia-info/10 border-economia-info/20", icon: RefreshCw },
  CLOSED: { label: "Cerrado", color: "text-economia-success bg-economia-success/10 border-economia-success/20", icon: CheckCircle },
  OVERDUE: { label: "Vencido", color: "text-economia-error bg-economia-error/10 border-economia-error/20", icon: AlertCircle },
};

const SEV_COLOR: Record<string, string> = {
  LOW: "text-economia-info", MEDIUM: "text-economia-warning", HIGH: "text-economia-error", CRITICAL: "text-economia-error font-bold",
};

export default function CapaPage() {
  const { role } = useRole();
  const isCompany = role === "company";
  const [tickets, setTickets] = useState<CapaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/capa");
      if (res.ok) {
        setTickets(await res.json());
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial
  useEffect(() => { load(); }, []);

  // Polling separado — pausa mientras el usuario está resolviendo un ticket
  useEffect(() => {
    if (resolvingId) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [resolvingId]);

  const updateStatus = async (id: string, status: string, resolution?: string): Promise<boolean> => {
    setUpdating(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/capa/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setActionError(err.error || "Error al actualizar el ticket.");
        return false;
      }
      await load();
      return true;
    } catch {
      setActionError("Error de conexión al actualizar el ticket.");
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const open = tickets.filter(t => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const closed = tickets.filter(t => t.status === "CLOSED");
  const overdue = tickets.filter(t => t.status === "OVERDUE");

  const daysLeft = (due: string) => {
    const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
    return d;
  };

  const TicketCard = ({ ticket }: { ticket: CapaTicket }) => {
    const cfg = STATUS_CONFIG[ticket.status];
    const Icon = cfg.icon;
    const isOpen = expanded === ticket.id;
    const days = daysLeft(ticket.dueDate);

    return (
      <div className={cn("bg-card border rounded-2xl overflow-hidden",
        ticket.status === "OVERDUE" ? "border-economia-error/20" : "border-border"
      )}>
        <button
          onClick={() => setExpanded(isOpen ? null : ticket.id)}
          className="w-full flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            ticket.status === "OVERDUE" ? "bg-economia-error/10" : "bg-economia-warning/10"
          )}>
            <ShieldAlert className={cn("h-4 w-4", ticket.status === "OVERDUE" ? "text-economia-error" : "text-economia-warning")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-medium truncate">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-muted-foreground/50 text-xs truncate">{ticket.user.companyName || ticket.user.name || ticket.user.email}</span>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <Link href={`/dashboard/documents/${ticket.document.id}`}
                className="text-muted-foreground/50 text-xs truncate hover:text-economia-info transition-colors"
                onClick={e => e.stopPropagation()}>
                {ticket.document.name}
              </Link>
              {ticket.finding && (
                <>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <span className={cn("text-[10px]", SEV_COLOR[ticket.finding.severity])}>{ticket.finding.severity}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ticket.status !== "CLOSED" && (
              <span className={cn("text-[10px] font-medium",
                days < 0 ? "text-economia-error" : days <= 5 ? "text-economia-warning" : "text-muted-foreground/50"
              )}>
                {days < 0 ? `Vencido hace ${Math.abs(days)}d` : `${days}d restantes`}
              </span>
            )}
            <span className={cn("text-[10px] font-medium px-2 py-1 rounded-full border", cfg.color)}>
              <Icon className="h-2.5 w-2.5 inline mr-1" />{cfg.label}
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-border p-4 space-y-3 bg-muted/20">
            <p className="text-muted-foreground text-xs leading-relaxed">{ticket.description}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
              <Clock className="h-3 w-3" />
              Plazo: {new Date(ticket.dueDate).toLocaleDateString("es-MX")}
              <span className="mx-2">·</span>
              Creado: {new Date(ticket.createdAt).toLocaleDateString("es-MX")}
            </div>
            {ticket.resolution && (
              <div className="bg-economia-success/10 border border-economia-success/20 rounded-xl p-3">
                <p className="text-[10px] text-economia-success font-medium mb-1">Resolución</p>
                <p className="text-foreground text-xs">{ticket.resolution}</p>
              </div>
            )}
            {ticket.status !== "CLOSED" && (
              <div className="space-y-3 pt-1">
                {resolvingId === ticket.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Describe la resolución aplicada..."
                      className="w-full px-3 py-2 text-xs bg-muted border border-border rounded-xl text-foreground placeholder-white/20 focus:outline-none focus:border-economia-success resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!resolutionText.trim()) return;
                          const ok = await updateStatus(ticket.id, "CLOSED", resolutionText);
                          if (ok) { setResolvingId(null); setResolutionText(""); }
                        }}
                        disabled={updating === ticket.id || !resolutionText.trim()}
                        className="text-xs bg-economia-success hover:bg-economia-success/90 text-black font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === ticket.id ? "Guardando..." : "Confirmar Cierre"}
                      </button>
                      <button
                        onClick={() => { setResolvingId(null); setResolutionText(""); }}
                        className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {ticket.status === "OPEN" && (
                      <button onClick={() => updateStatus(ticket.id, "IN_PROGRESS")} disabled={updating === ticket.id}
                        className="text-xs border border-economia-info/30 text-economia-info hover:bg-economia-info/10 px-3 py-1.5 rounded-lg transition-colors">
                        Marcar En Proceso
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setResolvingId(ticket.id);
                        setResolutionText("");
                      }}
                      disabled={updating === ticket.id}
                      className="text-xs bg-economia-success hover:bg-economia-success/90 text-black font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Cerrar CAPA
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="h-6 w-6 text-muted-foreground/30 animate-spin" />
    </div>
  );

  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertCircle className="h-10 w-10 text-economia-error/40" />
      <p className="text-muted-foreground text-sm">Error al cargar los tickets CAPA.</p>
      <button onClick={load}
        className="text-sm border border-border hover:border-economia-guinda/30 text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
        <RefreshCw className="h-4 w-4" /> Reintentar
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Tickets CAPA</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isCompany
              ? "Tus acciones correctivas y preventivas — plazo 30 días."
              : "Seguimiento global de acciones correctivas — todas las empresas."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overdue.length > 0 && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border text-economia-error bg-economia-error/10 border-economia-error/30">
              {overdue.length} vencido{overdue.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs font-medium px-3 py-1.5 rounded-full border text-economia-warning bg-economia-warning/10 border-economia-warning/30">
            {open.length} abierto{open.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="mx-8 mt-4 flex items-center justify-between gap-2 px-4 py-3 bg-economia-error/10 border border-economia-error/20 rounded-xl text-economia-error text-sm">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 text-economia-error/60 hover:text-economia-error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 p-8 overflow-auto space-y-8">
        {/* Completion banner for company: all CAPAs resolved */}
        {isCompany && tickets.length > 0 && open.length === 0 && overdue.length === 0 && closed.length > 0 && (
          <div className="bg-economia-success/10 border border-economia-success/30 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-economia-success shrink-0" />
            <div>
              <p className="text-economia-success text-sm font-semibold">¡Todas las acciones correctivas completadas!</p>
              <p className="text-muted-foreground text-xs mt-0.5">Tu expediente ha vuelto a revisión con el Assessor ESG.</p>
            </div>
          </div>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-economia-error mb-3">Vencidos · {overdue.length}</h2>
            <div className="space-y-2">{overdue.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          </section>
        )}

        {/* Open/in-progress */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-economia-warning mb-3">En curso · {open.length}</h2>
          {open.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border rounded-2xl">
              <CheckCircle className="h-10 w-10 text-economia-success/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Sin tickets CAPA abiertos.</p>
            </div>
          ) : (
            <div className="space-y-2">{open.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          )}
        </section>

        {/* Closed */}
        {closed.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/40 mb-3">Cerrados · {closed.length}</h2>
            <div className="space-y-2">{closed.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
