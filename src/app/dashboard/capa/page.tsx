"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Clock, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  OPEN: { label: "Abierto", color: "text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/20", icon: Clock },
  IN_PROGRESS: { label: "En proceso", color: "text-cetiem-teal bg-cetiem-teal/10 border-cetiem-teal/20", icon: RefreshCw },
  CLOSED: { label: "Cerrado", color: "text-cetiem-lime bg-cetiem-lime/10 border-cetiem-lime/20", icon: CheckCircle },
  OVERDUE: { label: "Vencido", color: "text-cetiem-red bg-cetiem-red/10 border-cetiem-red/20", icon: AlertCircle },
};

const SEV_COLOR: Record<string, string> = {
  LOW: "text-cetiem-teal", MEDIUM: "text-cetiem-amber", HIGH: "text-cetiem-red", CRITICAL: "text-cetiem-red font-bold",
};

export default function CapaPage() {
  const [tickets, setTickets] = useState<CapaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/capa");
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string, resolution?: string) => {
    setUpdating(id);
    await fetch(`/api/capa/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    await load();
    setUpdating(null);
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
      <div className={cn("bg-cetiem-card border rounded-2xl overflow-hidden",
        ticket.status === "OVERDUE" ? "border-cetiem-red/20" : "border-white/5"
      )}>
        <button
          onClick={() => setExpanded(isOpen ? null : ticket.id)}
          className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
        >
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
            ticket.status === "OVERDUE" ? "bg-cetiem-red/10" : "bg-cetiem-amber/10"
          )}>
            <ShieldAlert className={cn("h-4 w-4", ticket.status === "OVERDUE" ? "text-cetiem-red" : "text-cetiem-amber")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{ticket.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-cetiem-gray/50 text-xs truncate">{ticket.user.companyName || ticket.user.name || ticket.user.email}</span>
              <span className="text-cetiem-gray/30 text-xs">·</span>
              <span className="text-cetiem-gray/50 text-xs truncate">{ticket.document.name}</span>
              {ticket.finding && (
                <>
                  <span className="text-cetiem-gray/30 text-xs">·</span>
                  <span className={cn("text-[10px]", SEV_COLOR[ticket.finding.severity])}>{ticket.finding.severity}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ticket.status !== "CLOSED" && (
              <span className={cn("text-[10px] font-medium",
                days < 0 ? "text-cetiem-red" : days <= 5 ? "text-cetiem-amber" : "text-cetiem-gray/50"
              )}>
                {days < 0 ? `Vencido hace ${Math.abs(days)}d` : `${days}d restantes`}
              </span>
            )}
            <span className={cn("text-[10px] font-medium px-2 py-1 rounded-full border", cfg.color)}>
              <Icon className="h-2.5 w-2.5 inline mr-1" />{cfg.label}
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4 text-cetiem-gray" /> : <ChevronRight className="h-4 w-4 text-cetiem-gray" />}
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-white/5 p-4 space-y-3 bg-white/2">
            <p className="text-cetiem-gray text-xs leading-relaxed">{ticket.description}</p>
            <div className="flex items-center gap-2 text-xs text-cetiem-gray/50">
              <Clock className="h-3 w-3" />
              Plazo: {new Date(ticket.dueDate).toLocaleDateString("es-MX")}
              <span className="mx-2">·</span>
              Creado: {new Date(ticket.createdAt).toLocaleDateString("es-MX")}
            </div>
            {ticket.resolution && (
              <div className="bg-cetiem-lime/10 border border-cetiem-lime/20 rounded-xl p-3">
                <p className="text-[10px] text-cetiem-lime font-medium mb-1">Resolución</p>
                <p className="text-white text-xs">{ticket.resolution}</p>
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
                      className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-lime resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!resolutionText.trim()) return;
                          await updateStatus(ticket.id, "CLOSED", resolutionText);
                          setResolvingId(null);
                          setResolutionText("");
                        }}
                        disabled={updating === ticket.id || !resolutionText.trim()}
                        className="text-xs bg-cetiem-lime hover:bg-cetiem-lime/90 text-black font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === ticket.id ? "Guardando..." : "Confirmar Cierre"}
                      </button>
                      <button
                        onClick={() => { setResolvingId(null); setResolutionText(""); }}
                        className="text-xs text-cetiem-gray hover:text-white px-3 py-1.5 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {ticket.status === "OPEN" && (
                      <button onClick={() => updateStatus(ticket.id, "IN_PROGRESS")} disabled={updating === ticket.id}
                        className="text-xs border border-cetiem-teal/30 text-cetiem-teal hover:bg-cetiem-teal/10 px-3 py-1.5 rounded-lg transition-colors">
                        Marcar En Proceso
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setResolvingId(ticket.id);
                        setResolutionText("");
                      }}
                      disabled={updating === ticket.id}
                      className="text-xs bg-cetiem-lime hover:bg-cetiem-lime/90 text-black font-medium px-3 py-1.5 rounded-lg transition-colors"
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
      <RefreshCw className="h-6 w-6 text-cetiem-gray/30 animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div>
          <h1 className="font-heading font-bold text-2xl text-white">Tickets CAPA</h1>
          <p className="text-cetiem-gray text-sm mt-0.5">Acciones correctivas y preventivas — plazo 30 días.</p>
        </div>
        <div className="flex items-center gap-3">
          {overdue.length > 0 && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border text-cetiem-red bg-cetiem-red/10 border-cetiem-red/30">
              {overdue.length} vencido{overdue.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs font-medium px-3 py-1.5 rounded-full border text-cetiem-amber bg-cetiem-amber/10 border-cetiem-amber/30">
            {open.length} abierto{open.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto space-y-8">
        {/* Overdue */}
        {overdue.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cetiem-red mb-3">Vencidos · {overdue.length}</h2>
            <div className="space-y-2">{overdue.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          </section>
        )}

        {/* Open/in-progress */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-cetiem-amber mb-3">En curso · {open.length}</h2>
          {open.length === 0 ? (
            <div className="text-center py-10 bg-cetiem-card border border-white/5 rounded-2xl">
              <CheckCircle className="h-10 w-10 text-cetiem-lime/30 mx-auto mb-3" />
              <p className="text-cetiem-gray text-sm">Sin tickets CAPA abiertos.</p>
            </div>
          ) : (
            <div className="space-y-2">{open.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          )}
        </section>

        {/* Closed */}
        {closed.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-cetiem-gray/40 mb-3">Cerrados · {closed.length}</h2>
            <div className="space-y-2">{closed.map(t => <TicketCard key={t.id} ticket={t} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
