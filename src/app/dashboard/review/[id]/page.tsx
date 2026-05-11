"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";
import {
  CheckCircle, XCircle, MessageSquare, ChevronLeft,
  Flag, Plus, Trash2, RefreshCw, AlertCircle, FileText,
  ShieldCheck, ShieldAlert, Clock, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────── Types ──────────────────────────── */
interface VlapBool { value: boolean | null; confidence: number; override: boolean }
interface Vlap {
  vigencia: VlapBool;
  legibilidad: VlapBool;
  autoria: VlapBool;
  pertinencia: VlapBool;
}

const VLAP_KEYS = ["vigencia", "legibilidad", "autoria", "pertinencia"] as const;
const VLAP_LABELS: Record<typeof VLAP_KEYS[number], { label: string; hint: string }> = {
  vigencia: { label: "Vigencia", hint: "El documento está vigente / dentro del período válido" },
  legibilidad: { label: "Legibilidad", hint: "El texto es legible y el contenido es comprensible" },
  autoria: { label: "Autoría", hint: "Se identifica claramente el autor o entidad emisora" },
  pertinencia: { label: "Pertinencia", hint: "El contenido es relevante y pertinente al proceso ESG" },
};

const HARD_STOP_THRESHOLD = 85;

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
  storageUrl: string;
  user?: { name: string | null; email: string };
}

interface ExistingCert {
  id: string;
  status: string;
  requirements: {
    verdict?: string; notes?: string; assessorEmail?: string; assessedAt?: string;
    vlap?: Record<string, { value: boolean | null; confidence: number; override: boolean }>;
    confidenceScore?: number;
    aiRecommendation?: string;
  };
  findings: Array<{
    id: string; type: string; severity: string; title: string;
    description: string; evidence?: string | null;
  }>;
}


const FINDING_TYPES = [
  { id: "COMPLIANCE", label: "Cumplimiento", color: "text-economia-success" },
  { id: "NON_COMPLIANCE", label: "No Conformidad", color: "text-economia-error" },
  { id: "OBSERVATION", label: "Observación", color: "text-economia-warning" },
];
const SEVERITIES = [
  { id: "LOW", label: "Bajo", color: "bg-economia-info/20   text-economia-info" },
  { id: "MEDIUM", label: "Medio", color: "bg-economia-warning/20  text-economia-warning" },
  { id: "HIGH", label: "Alto", color: "bg-economia-error/20    text-economia-error" },
  { id: "CRITICAL", label: "Crítico", color: "bg-economia-error/40    text-economia-error font-bold" },
];

const verdictConfig = {
  APPROVED: { label: "Aprobar", icon: CheckCircle, color: "bg-economia-success  hover:bg-economia-success/90  text-black" },
  CHANGES_REQUESTED: { label: "Solicitar Cambios", icon: MessageSquare, color: "bg-economia-warning hover:bg-economia-warning/90 text-black" },
  REJECTED: { label: "Rechazar", icon: XCircle, color: "bg-economia-error   hover:bg-economia-error/90   text-primary-foreground" },
};

const certStatusLabel: Record<string, string> = {
  APPROVED: "Aprobado", IN_REVIEW: "Cambios solicitados",
  REJECTED: "Rechazado", REVOKED: "Revocado", CAPA_OPEN: "CAPA Abierta",
};
const certStatusColor: Record<string, string> = {
  APPROVED: "bg-economia-success/10 border-economia-success/30 text-economia-success",
  IN_REVIEW: "bg-economia-warning/10 border-economia-warning/30 text-economia-warning",
  REJECTED: "bg-economia-error/10 border-economia-error/30 text-economia-error",
  CAPA_OPEN: "bg-economia-warning/10 border-economia-warning/30 text-economia-warning",
};

/* ──────────────────────────── VLAP Panel ────────────────────── */
function VlapPanel({ vlap, onChange }: {
  vlap: Vlap;
  onChange: (key: typeof VLAP_KEYS[number], field: keyof VlapBool, value: any) => void;
}) {
  const allPassed = VLAP_KEYS.every(k => vlap[k].value === true || vlap[k].override);
  const hasHardStop = VLAP_KEYS.some(k =>
    vlap[k].confidence < HARD_STOP_THRESHOLD && !vlap[k].override && vlap[k].value !== null
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-3.5 w-3.5 text-economia-info" />
        <span className="text-xs font-semibold text-foreground">Motor V.L.A.P.</span>
        {hasHardStop && (
          <span className="text-[9px] font-bold bg-economia-error/20 text-economia-error px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> Hard Stop
          </span>
        )}
        {!hasHardStop && allPassed && (
          <span className="text-[9px] font-bold bg-economia-success/20 text-economia-success px-1.5 py-0.5 rounded-full">
            ✓ V.L.A.P. OK
          </span>
        )}
      </div>

      {VLAP_KEYS.map(key => {
        const item = vlap[key];
        const meta = VLAP_LABELS[key];
        const isHardStop = item.confidence < HARD_STOP_THRESHOLD && !item.override && item.value !== null;

        return (
          <div key={key} className={cn(
            "bg-muted/40 border rounded-xl p-3 space-y-2",
            isHardStop ? "border-economia-error/30" :
              item.value === true ? "border-economia-success/20" :
                item.value === false ? "border-economia-error/20" :
                  "border-border"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-foreground">{meta.label}</span>
                <p className="text-[10px] text-muted-foreground/50 leading-tight">{meta.hint}</p>
              </div>
              {/* Toggle */}
              <div className="flex items-center gap-1.5">
                {[true, false].map(val => (
                  <button
                    key={String(val)}
                    onClick={() => onChange(key, "value", item.value === val ? null : val)}
                    className={cn(
                      "h-6 w-6 rounded-lg border text-[9px] font-bold transition-all",
                      item.value === val
                        ? val ? "bg-economia-success/20 border-economia-success/40 text-economia-success" : "bg-economia-error/20 border-economia-error/40 text-economia-error"
                        : "bg-muted border-border text-muted-foreground/40"
                    )}
                  >
                    {val ? "✓" : "✗"}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence score */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50 w-20">Confianza</span>
              <input
                type="range" min="0" max="100"
                value={item.confidence}
                onChange={e => onChange(key, "confidence", parseInt(e.target.value))}
                className="flex-1 h-1.5 accent-economia-info"
              />
              <span className={cn("text-[10px] font-mono w-8 text-right",
                item.confidence >= HARD_STOP_THRESHOLD ? "text-economia-success" : "text-economia-error"
              )}>
                {item.confidence}%
              </span>
            </div>

            {/* Hard Stop warning + override */}
            {isHardStop && (
              <div className="flex items-center justify-between bg-economia-error/10 border border-economia-error/20 rounded-lg px-2 py-1.5">
                <span className="text-[9px] text-economia-error flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Hard Stop — confianza &lt; {HARD_STOP_THRESHOLD}%
                </span>
                <button
                  onClick={() => onChange(key, "override", !item.override)}
                  className="text-[9px] text-economia-warning border border-economia-warning/30 px-2 py-0.5 rounded-lg hover:bg-economia-warning/10 transition-colors"
                >
                  Override manual
                </button>
              </div>
            )}
            {item.override && (
              <div className="text-[9px] text-economia-warning bg-economia-warning/10 px-2 py-1 rounded-lg">
                Override activo — revisión manual aplicada
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── Main Page ─────────────────────── */
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useRole();

  // Solo assessors y admins pueden emitir dictámenes
  useEffect(() => {
    if (role && role === "company") router.replace("/dashboard");
  }, [role, router]);

  const [doc, setDoc] = useState<DocInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfError, setPdfError] = useState(false);
  const [existingCert, setExistingCert] = useState<ExistingCert | null>(null);

  const [findings, setFindings] = useState<Finding[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [verdict, setVerdict] = useState<"" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showNewFinding, setShowNewFinding] = useState(false);
  const [newFinding, setNewFinding] = useState<Omit<Finding, "id">>({
    type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", page: undefined,
  });

  // V.L.A.P. state
  const [vlap, setVlap] = useState<Vlap>({
    vigencia: { value: null, confidence: 0, override: false },
    legibilidad: { value: null, confidence: 0, override: false },
    autoria: { value: null, confidence: 0, override: false },
    pertinencia: { value: null, confidence: 0, override: false },
  });

  const vlapHardStop = VLAP_KEYS.some(k =>
    vlap[k].confidence < HARD_STOP_THRESHOLD && !vlap[k].override && vlap[k].value !== null
  );
  const vlapScore = VLAP_KEYS.reduce((acc, k) => acc + vlap[k].confidence, 0) / 4;

  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setDoc(data); setPdfUrl(data.storageUrl); }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/documents/${id}/certifications`)
      .then(r => r.ok ? r.json() : null)
      .then((cert: ExistingCert | null) => {
        if (!cert) return;
        setExistingCert(cert);
        const prevVerdict = cert.requirements?.verdict as typeof verdict | undefined;
        if (prevVerdict) setVerdict(prevVerdict);
        if (cert.requirements?.notes) setGeneralNotes(cert.requirements.notes);

        // Restore VLAP
        if (cert.requirements?.vlap) {
          const prevVlap = cert.requirements.vlap;
          setVlap(prev => {
            const next = { ...prev };
            for (const key of VLAP_KEYS) {
              if (prevVlap[key]) next[key] = { ...prevVlap[key] };
            }
            return next;
          });
        }

        setFindings(
          cert.findings.map(f => ({
            id: f.id,
            type: f.type as Finding["type"],
            severity: f.severity as Finding["severity"],
            title: f.title,
            description: f.description,
            page: f.evidence?.startsWith("Página ") ? parseInt(f.evidence.replace("Página ", "")) : undefined,
          }))
        );
      })
      .catch(() => { });
  }, [id]);

  const updateVlap = (key: typeof VLAP_KEYS[number], field: keyof VlapBool, value: any) => {
    setVlap(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const addFinding = () => {
    if (!newFinding.title.trim()) return;
    setFindings(prev => [...prev, { ...newFinding, id: crypto.randomUUID() }]);
    setNewFinding({ type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", page: undefined });
    setShowNewFinding(false);
  };

  const removeFinding = (fid: string) => setFindings(prev => prev.filter(f => f.id !== fid));

  const handleSave = async () => {
    if (!verdict) return;
    if (vlapHardStop && !VLAP_KEYS.every(k => vlap[k].override || vlap[k].confidence >= HARD_STOP_THRESHOLD)) {
      setError("Hard Stop activo: hay criterios V.L.A.P. con confianza < 85% sin override. Aplica override manual o corrige los valores antes de emitir.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${id}/certifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          notes: generalNotes,
          findings,
          vlap,
          confidenceScore: Math.round(vlapScore),
          aiRecommendation: null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar el dictamen.");
        return;
      }
      router.push("/dashboard/queue?saved=1");
    } catch {
      setError("Error de conexión al guardar el dictamen.");
    } finally {
      setSaving(false);
    }
  };

  const ncCount = findings.filter(f => f.type === "NON_COMPLIANCE").length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-card border-b border-border shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ChevronLeft className="h-4 w-4" /> Volver
        </button>
        <div className="h-4 w-px bg-muted" />
        {loading ? (
          <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-economia-warning" />
            <span className="font-sans font-semibold text-foreground text-sm">{doc?.name}</span>
            <span className="text-muted-foreground/50 text-xs">{doc?.user?.name || doc?.user?.email || "Empresa"}</span>
            {existingCert && (
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", certStatusColor[existingCert.status])}>
                Dictamen previo: {certStatusLabel[existingCert.status] ?? existingCert.status}
              </span>
            )}
            {/* V.L.A.P. score indicator */}
            <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded-full",
              vlapScore >= HARD_STOP_THRESHOLD ? "bg-economia-success/10 text-economia-success" : "bg-economia-error/10 text-economia-error"
            )}>
              VLAP {Math.round(vlapScore)}%
            </span>
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
                    verdict === key ? cfg.color + " border-transparent" : "bg-muted border-border text-muted-foreground hover:text-foreground"
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
              verdict && !saving ? "bg-[#00D47A] hover:bg-[#00D47A]/90 text-primary-foreground" : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Guardando..." : existingCert ? "Actualizar Dictamen" : "Emitir Dictamen"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 bg-economia-error/10 border-b border-economia-error/20 text-economia-error text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {vlapHardStop && !error && (
        <div className="px-5 py-1.5 bg-economia-error/5 border-b border-economia-error/10 text-economia-error/70 text-[10px] flex items-center gap-2">
          <Zap className="h-3 w-3 shrink-0" />
          Hard Stop activo — uno o más criterios V.L.A.P. tienen confianza &lt; {HARD_STOP_THRESHOLD}%. Requiere override manual.
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — PDF Viewer */}
        <div className="flex-1 bg-[#111] border-r border-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 bg-card border-b border-border flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">Visor PDF</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-muted-foreground/30 animate-spin" />
            </div>
          ) : pdfUrl && !pdfError ? (
            <iframe
              src={pdfUrl}
              className="flex-1 w-full"
              title="Documento PDF"
              onError={() => setPdfError(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <AlertCircle className="h-10 w-10 text-economia-error/40" />
              <p className="text-muted-foreground text-sm">No se pudo cargar el PDF</p>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs bg-[#00D47A] hover:bg-[#00D47A]/90 text-primary-foreground font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Abrir PDF en nueva pestaña
                </a>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Audit form */}
        <div className="w-[440px] flex flex-col bg-economia-verdeDark border-l border-border overflow-hidden shrink-0">
          <div className="px-4 py-2 bg-card border-b border-border shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">Formulario de Auditoría</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Document info */}
            {doc && (
              <div className="bg-card border border-border rounded-xl p-4 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="text-foreground font-medium">{doc.user?.name || doc.user?.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dominio</span>
                  <span className="text-economia-info font-medium capitalize">{doc.domain?.toLowerCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado IA</span>
                  <span className={cn("font-medium", doc.status === "ANALYZED" ? "text-economia-success" : "text-economia-warning")}>
                    {doc.status}
                  </span>
                </div>
                {doc.description && (
                  <p className="text-muted-foreground/60 pt-1 border-t border-border leading-relaxed">{doc.description}</p>
                )}
              </div>
            )}

            {/* ── AI Knowledge Graph ── */}
            {/* ── V.L.A.P. Motor ── */}
            <VlapPanel vlap={vlap} onChange={updateVlap} />

            {/* ── Hallazgos ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-economia-warning" /> Hallazgos
                  {findings.length > 0 && (
                    <span className="bg-economia-warning text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{findings.length}</span>
                  )}
                  {ncCount > 0 && (
                    <span className="bg-economia-error/20 text-economia-error text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" />{ncCount} NC → CAPA
                    </span>
                  )}
                </span>
                <button onClick={() => setShowNewFinding(!showNewFinding)}
                  className="flex items-center gap-1 text-[10px] text-[#00D47A] hover:text-economia-success transition-colors">
                  <Plus className="h-3 w-3" /> Añadir
                </button>
              </div>

              {showNewFinding && (
                <div className="bg-card border border-economia-warning/20 rounded-xl p-3 mb-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Tipo</label>
                      <select value={newFinding.type} onChange={e => setNewFinding(p => ({ ...p, type: e.target.value as Finding["type"] }))}
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground focus:outline-none">
                        {FINDING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Severidad</label>
                      <select value={newFinding.severity} onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value as Finding["severity"] }))}
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground focus:outline-none">
                        {SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Título del hallazgo</label>
                    <input type="text" value={newFinding.title} onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Falta firma en el documento..."
                      className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none focus:border-economia-warning" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Descripción</label>
                    <textarea value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                      placeholder="Detalla el hallazgo encontrado..." rows={2}
                      className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none focus:border-economia-warning resize-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground mb-1 block">Página (opcional)</label>
                      <input type="number" value={newFinding.page ?? ""} onChange={e => setNewFinding(p => ({ ...p, page: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="ej: 12"
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none" />
                    </div>
                    <div className="flex gap-1.5 mt-4">
                      <button onClick={() => setShowNewFinding(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground">
                        Cancelar
                      </button>
                      <button onClick={addFinding} disabled={!newFinding.title.trim()}
                        className="px-3 py-1.5 text-xs bg-economia-warning hover:bg-economia-warning/90 text-black font-medium rounded-lg disabled:opacity-40">
                        Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {findings.map(f => {
                  const sev = SEVERITIES.find(s => s.id === f.severity)!;
                  const type = FINDING_TYPES.find(t => t.id === f.type)!;
                  return (
                    <div key={f.id} className={cn(
                      "bg-card border rounded-xl p-3",
                      f.type === "NON_COMPLIANCE" ? "border-economia-error/20" : "border-border"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[9px] font-medium", type?.color)}>{type?.label}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", sev?.color)}>{sev?.label}</span>
                          {f.page && <span className="text-[9px] text-muted-foreground/50">Pág. {f.page}</span>}
                          {f.type === "NON_COMPLIANCE" && (
                            <span className="text-[9px] text-economia-error/70">→ CAPA 30d</span>
                          )}
                        </div>
                        <button onClick={() => removeFinding(f.id)} className="text-muted-foreground/30 hover:text-economia-error transition-colors shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-foreground text-xs font-medium">{f.title}</p>
                      {f.description && <p className="text-muted-foreground/60 text-[10px] mt-0.5 leading-relaxed">{f.description}</p>}
                    </div>
                  );
                })}
                {findings.length === 0 && !showNewFinding && (
                  <p className="text-muted-foreground/30 text-xs text-center py-4">Sin hallazgos añadidos</p>
                )}
              </div>
            </div>

            {/* Notas generales */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-economia-info" /> Notas para la Empresa
              </label>
              <textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                placeholder="Comentarios que verá la empresa: contexto, qué debe corregir, plazos, etc."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl text-foreground placeholder-white/20 focus:outline-none focus:border-economia-info resize-none"
              />
            </div>

            {/* Summary */}
            {verdict && (
              <div className={cn("rounded-xl p-3 text-xs font-medium space-y-1",
                verdict === "APPROVED" ? "bg-economia-success/10 border border-economia-success/20" :
                  verdict === "CHANGES_REQUESTED" ? "bg-economia-warning/10 border border-economia-warning/20" :
                    "bg-economia-error/10 border border-economia-error/20"
              )}>
                <div className="flex items-center gap-2">
                  {verdict === "APPROVED" && <CheckCircle className="h-4 w-4 text-economia-success shrink-0" />}
                  {verdict === "CHANGES_REQUESTED" && <MessageSquare className="h-4 w-4 text-economia-warning shrink-0" />}
                  {verdict === "REJECTED" && <XCircle className="h-4 w-4 text-economia-error shrink-0" />}
                  <span className={verdict === "APPROVED" ? "text-economia-success" : verdict === "CHANGES_REQUESTED" ? "text-economia-warning" : "text-economia-error"}>
                    Dictamen: {verdict === "APPROVED" ? "Aprobado" : verdict === "CHANGES_REQUESTED" ? "Se requieren cambios" : "Rechazado"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground/60 text-[10px]">
                  <span>Score VLAP: <strong className="text-foreground">{Math.round(vlapScore)}%</strong></span>
                  {ncCount > 0 && <span className="text-economia-warning">{ncCount} CAPA ticket{ncCount !== 1 ? "s" : ""} se crearán</span>}
                  {verdict === "APPROVED" && <span className="text-economia-info flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Hash SHA-256 generado</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
