"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, MessageSquare, ChevronLeft,
  Flag, Plus, Trash2, RefreshCw, AlertCircle, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Finding {
  id: string;
  type: "COMPLIANCE" | "NON_COMPLIANCE" | "OBSERVATION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  page?: number;
}

interface DocInfo {
  id: string; name: string; status: string; domain: string; description: string | null;
  user?: { name: string | null; email: string };
}

const FINDING_TYPES = [
  { id: "COMPLIANCE",     label: "Cumplimiento",  color: "text-cetiem-lime"  },
  { id: "NON_COMPLIANCE", label: "No Conformidad", color: "text-cetiem-red"   },
  { id: "OBSERVATION",    label: "Observación",   color: "text-cetiem-amber" },
]
const SEVERITIES = [
  { id: "LOW",      label: "Bajo",     color: "bg-cetiem-teal/20   text-cetiem-teal"  },
  { id: "MEDIUM",   label: "Medio",    color: "bg-cetiem-amber/20  text-cetiem-amber" },
  { id: "HIGH",     label: "Alto",     color: "bg-cetiem-red/20    text-cetiem-red"   },
  { id: "CRITICAL", label: "Crítico",  color: "bg-cetiem-red/40    text-cetiem-red font-bold" },
]

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [verdict, setVerdict] = useState<"" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED">("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // New finding form
  const [showNewFinding, setShowNewFinding] = useState(false);
  const [newFinding, setNewFinding] = useState<Omit<Finding, "id">>({
    type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", page: undefined,
  });

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDoc(data);
          setPdfUrl(`/api/files/${id}/${id}.pdf`);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const addFinding = () => {
    if (!newFinding.title.trim()) return;
    setFindings(prev => [...prev, { ...newFinding, id: crypto.randomUUID() }]);
    setNewFinding({ type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", page: undefined });
    setShowNewFinding(false);
  };

  const removeFinding = (fid: string) => setFindings(prev => prev.filter(f => f.id !== fid));

  const handleSave = async () => {
    if (!verdict) return;
    setSaving(true);
    // Simulate save (actual API integration goes here)
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const verdictConfig = {
    APPROVED:          { label: "Aprobar",           icon: CheckCircle, color: "bg-cetiem-lime  hover:bg-cetiem-lime/90  text-black" },
    CHANGES_REQUESTED: { label: "Solicitar Cambios",  icon: MessageSquare, color: "bg-cetiem-amber hover:bg-cetiem-amber/90 text-black" },
    REJECTED:          { label: "Rechazar",           icon: XCircle,     color: "bg-cetiem-red   hover:bg-cetiem-red/90   text-white" },
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-cetiem-card border-b border-white/5 shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-cetiem-gray hover:text-white text-sm transition-colors">
          <ChevronLeft className="h-4 w-4" /> Volver
        </button>
        <div className="h-4 w-px bg-white/10" />
        {loading ? (
          <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-cetiem-amber" />
            <span className="font-heading font-semibold text-white text-sm">{doc?.name}</span>
            <span className="text-cetiem-gray/50 text-xs">{doc?.user?.name || doc?.user?.email || 'Empresa'}</span>
          </div>
        )}
        <div className="flex-1" />
        {/* Verdict buttons */}
        <div className="flex items-center gap-2">
          {(Object.entries(verdictConfig) as [typeof verdict, typeof verdictConfig[keyof typeof verdictConfig]][])
            .filter(([k]) => k !== "")
            .map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => setVerdict(verdict === key ? "" : key as typeof verdict)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    verdict === key ? cfg.color : "bg-white/5 border-white/10 text-cetiem-gray hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          <button
            onClick={handleSave}
            disabled={!verdict || saving}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
              verdict && !saving ? "bg-cetiem-green hover:bg-cetiem-green/90 text-white" : "bg-white/5 text-cetiem-gray/40 cursor-not-allowed"
            )}
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle className="h-3.5 w-3.5" /> : null}
            {saving ? "Guardando..." : saved ? "¡Guardado!" : "Emitir Dictamen"}
          </button>
        </div>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — PDF Viewer */}
        <div className="flex-1 bg-[#111] border-r border-white/5 overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-cetiem-card border-b border-white/5 flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest">Visor PDF</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-cetiem-gray/30 animate-spin" />
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="flex-1 w-full" title="Documento PDF" />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="h-10 w-10 text-cetiem-red/40" />
              <p className="text-cetiem-gray text-sm">No se pudo cargar el PDF</p>
            </div>
          )}
        </div>

        {/* RIGHT — Audit form */}
        <div className="w-[420px] flex flex-col bg-cetiem-dark border-l border-white/5 overflow-hidden shrink-0">
          <div className="px-4 py-2 bg-cetiem-card border-b border-white/5 shrink-0">
            <span className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest">Formulario de Auditoría</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Document info */}
            {doc && (
              <div className="bg-cetiem-card border border-white/5 rounded-xl p-4 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-cetiem-gray">Empresa</span>
                  <span className="text-white font-medium">{doc.user?.name || doc.user?.email || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cetiem-gray">Dominio</span>
                  <span className="text-cetiem-teal font-medium capitalize">{doc.domain?.toLowerCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cetiem-gray">Estado IA</span>
                  <span className={cn("font-medium",
                    doc.status === 'ANALYZED' ? 'text-cetiem-lime' : 'text-cetiem-amber'
                  )}>{doc.status}</span>
                </div>
                {doc.description && (
                  <p className="text-cetiem-gray/60 pt-1 border-t border-white/5 leading-relaxed">{doc.description}</p>
                )}
              </div>
            )}

            {/* Hallazgos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-cetiem-amber" /> Hallazgos
                  {findings.length > 0 && (
                    <span className="bg-cetiem-amber text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{findings.length}</span>
                  )}
                </span>
                <button onClick={() => setShowNewFinding(!showNewFinding)}
                  className="flex items-center gap-1 text-[10px] text-cetiem-green hover:text-cetiem-lime transition-colors">
                  <Plus className="h-3 w-3" /> Añadir
                </button>
              </div>

              {/* New finding form */}
              {showNewFinding && (
                <div className="bg-cetiem-card border border-cetiem-amber/20 rounded-xl p-3 mb-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Tipo</label>
                      <select value={newFinding.type} onChange={e => setNewFinding(p => ({ ...p, type: e.target.value as Finding["type"] }))}
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none">
                        {FINDING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Severidad</label>
                      <select value={newFinding.severity} onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value as Finding["severity"] }))}
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none">
                        {SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-cetiem-gray mb-1 block">Título del hallazgo</label>
                    <input type="text" value={newFinding.title} onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Falta firma en el documento..."
                      className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-cetiem-amber" />
                  </div>
                  <div>
                    <label className="text-[10px] text-cetiem-gray mb-1 block">Descripción</label>
                    <textarea value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                      placeholder="Detalla el hallazgo encontrado..."
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-cetiem-amber resize-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Página (opcional)</label>
                      <input type="number" value={newFinding.page ?? ''} onChange={e => setNewFinding(p => ({ ...p, page: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="ej: 12"
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none" />
                    </div>
                    <div className="flex gap-1.5 mt-4">
                      <button onClick={() => setShowNewFinding(false)} className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-cetiem-gray hover:text-white">
                        Cancelar
                      </button>
                      <button onClick={addFinding} disabled={!newFinding.title.trim()}
                        className="px-3 py-1.5 text-xs bg-cetiem-amber hover:bg-cetiem-amber/90 text-black font-medium rounded-lg disabled:opacity-40">
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Findings list */}
              <div className="space-y-2">
                {findings.map(f => {
                  const sev = SEVERITIES.find(s => s.id === f.severity)!
                  const type = FINDING_TYPES.find(t => t.id === f.type)!
                  return (
                    <div key={f.id} className="bg-cetiem-card border border-white/5 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[9px] font-medium", type.color)}>{type.label}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", sev.color)}>{sev.label}</span>
                          {f.page && <span className="text-[9px] text-cetiem-gray/50">Pág. {f.page}</span>}
                        </div>
                        <button onClick={() => removeFinding(f.id)} className="text-cetiem-gray/30 hover:text-cetiem-red transition-colors shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-white text-xs font-medium">{f.title}</p>
                      {f.description && <p className="text-cetiem-gray/60 text-[10px] mt-0.5 leading-relaxed">{f.description}</p>}
                    </div>
                  )
                })}
                {findings.length === 0 && !showNewFinding && (
                  <p className="text-cetiem-gray/30 text-xs text-center py-4">Sin hallazgos añadidos</p>
                )}
              </div>
            </div>

            {/* Notas generales */}
            <div>
              <label className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-cetiem-teal" /> Notas Generales
              </label>
              <textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="Comentarios generales sobre el expediente, contexto adicional..."
                rows={4}
                className="w-full px-3 py-2 text-xs bg-cetiem-card border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-teal resize-none"
              />
            </div>

            {/* Verdict summary */}
            {verdict && (
              <div className={cn("rounded-xl p-3 text-xs font-medium flex items-center gap-2",
                verdict === 'APPROVED'          ? 'bg-cetiem-lime/10 border border-cetiem-lime/20 text-cetiem-lime' :
                verdict === 'CHANGES_REQUESTED' ? 'bg-cetiem-amber/10 border border-cetiem-amber/20 text-cetiem-amber' :
                                                  'bg-cetiem-red/10 border border-cetiem-red/20 text-cetiem-red'
              )}>
                {verdict === 'APPROVED' && <CheckCircle className="h-4 w-4 shrink-0" />}
                {verdict === 'CHANGES_REQUESTED' && <MessageSquare className="h-4 w-4 shrink-0" />}
                {verdict === 'REJECTED' && <XCircle className="h-4 w-4 shrink-0" />}
                Dictamen: {verdict === 'APPROVED' ? 'Aprobado' : verdict === 'CHANGES_REQUESTED' ? 'Se requieren cambios' : 'Rechazado'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
