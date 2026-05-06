"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, MessageSquare, ChevronLeft,
  Flag, Plus, Trash2, RefreshCw, AlertCircle, FileText,
  ShieldCheck, ShieldAlert, Clock, Zap, Building2, ChevronDown,
  Sparkles, CheckCheck, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PdfInlineViewer } from "@/components/pdf-inline-viewer";

/* ── Types ── */
interface VlapBool { value: boolean | null; confidence: number; override: boolean }
interface Vlap {
  vigencia: VlapBool; legibilidad: VlapBool; autoria: VlapBool; pertinencia: VlapBool;
}
const VLAP_KEYS = ["vigencia", "legibilidad", "autoria", "pertinencia"] as const;
const VLAP_LABELS: Record<typeof VLAP_KEYS[number], { label: string; hint: string }> = {
  vigencia:    { label: "Vigencia",    hint: "Los documentos están vigentes y dentro del período válido" },
  legibilidad: { label: "Legibilidad", hint: "Los textos son legibles y el contenido es comprensible" },
  autoria:     { label: "Autoría",     hint: "Se identifica claramente el autor o entidad emisora" },
  pertinencia: { label: "Pertinencia", hint: "El contenido es relevante y pertinente al proceso ESG" },
};
const HARD_STOP = 85;

interface DocSummary {
  id: string; name: string; status: string; domain: string; storageUrl: string; updatedAt: string;
  pageIndices: { id: string; level: number; title: string; page: number | null }[];
}
interface CompanyInfo {
  id: string; name: string | null; email: string; companyName: string | null;
  track: string | null; sprintLevel: string;
}
interface Finding {
  id: string; type: "COMPLIANCE" | "NON_COMPLIANCE" | "OBSERVATION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string; description: string; page?: number; documentId?: string;
}
interface ExistingCert {
  id: string; status: string;
  requirements: {
    verdict?: string; notes?: string; assessorEmail?: string; assessedAt?: string;
    vlap?: Record<string, VlapBool>; confidenceScore?: number; findings?: any[];
    documentIds?: string[];
  };
  esgScore?: number | null;
}

interface AiVlapItem { suggestion: boolean | null; confidence: number; rationale: string }
interface AiDictamen {
  id: string; status: "GENERATING" | "READY" | "FAILED";
  vlap?: Record<string, AiVlapItem>;
  findings: Array<{
    type: string; severity: string; title: string;
    description: string; recommendation: string;
    documentId?: string; documentName?: string; page?: number | null;
  }>;
  summary?: string;
  generatedAt: string;
  errorMsg?: string;
}

const FINDING_TYPES = [
  { id: "COMPLIANCE",     label: "Cumplimiento",   color: "text-economia-success"  },
  { id: "NON_COMPLIANCE", label: "No Conformidad",  color: "text-economia-error"   },
  { id: "OBSERVATION",    label: "Observación",    color: "text-economia-warning" },
];
const SEVERITIES = [
  { id: "LOW",      label: "Bajo",    color: "bg-economia-info/20   text-economia-info"  },
  { id: "MEDIUM",   label: "Medio",   color: "bg-economia-warning/20  text-economia-warning" },
  { id: "HIGH",     label: "Alto",    color: "bg-economia-error/20    text-economia-error"   },
  { id: "CRITICAL", label: "Crítico", color: "bg-economia-error/40    text-economia-error font-bold" },
];
const VERDICT_CONFIG = {
  APPROVED:          { label: "Aprobar",          icon: CheckCircle,   color: "bg-economia-success  hover:bg-economia-success/90  text-black" },
  CHANGES_REQUESTED: { label: "Solicitar Cambios", icon: MessageSquare, color: "bg-economia-warning hover:bg-economia-warning/90 text-black" },
  REJECTED:          { label: "Rechazar",          icon: XCircle,      color: "bg-economia-error   hover:bg-economia-error/90   text-primary-foreground" },
};
const TRACK_LABEL: Record<string, string> = {
  A: "Track A — Industria", B: "Track B — Construcción", C: "Track C — Tecnología",
};

/* Confidence chip levels — replaces slider */
const CONF_LEVELS = [
  { label: "–",       value: 0,   active: "text-muted-foreground/50 bg-muted       border-border" },
  { label: "Bajo",    value: 60,  active: "text-economia-error     bg-economia-error/15   border-economia-error/30" },
  { label: "Parcial", value: 75,  active: "text-economia-warning   bg-economia-warning/15 border-economia-warning/30" },
  { label: "≥85%",    value: 88,  active: "text-economia-success    bg-economia-success/15  border-economia-success/30" },
  { label: "Pleno",   value: 100, active: "text-economia-success    bg-economia-success/20  border-economia-success/40" },
] as const;

/* ── VLAP Panel ── */
function VlapPanel({ vlap, onChange }: {
  vlap: Vlap;
  onChange: (key: typeof VLAP_KEYS[number], field: keyof VlapBool, value: any) => void;
}) {
  const allPassed   = VLAP_KEYS.every(k => vlap[k].value === true || vlap[k].override);
  const hasHardStop = VLAP_KEYS.some(k =>
    vlap[k].confidence < HARD_STOP && !vlap[k].override && vlap[k].value !== null
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-3.5 w-3.5 text-economia-info" />
        <span className="text-xs font-semibold text-foreground">Motor V.L.A.P.</span>
        {hasHardStop && (
          <span className="text-[9px] font-bold bg-economia-error/20 text-economia-error px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> Hard Stop
          </span>
        )}
        {!hasHardStop && allPassed && (
          <span className="text-[9px] font-bold bg-economia-success/20 text-economia-success px-1.5 py-0.5 rounded-full">✓ OK</span>
        )}
      </div>

      <div className="bg-muted/40 border border-border rounded-xl overflow-hidden">
        {VLAP_KEYS.map((key, i) => {
          const item = vlap[key];
          const meta = VLAP_LABELS[key];
          const isHS = item.confidence < HARD_STOP && !item.override && item.value !== null && item.confidence > 0;
          return (
            <div key={key} className={cn(
              "flex items-center gap-2 px-3 py-2.5",
              i < VLAP_KEYS.length - 1 && "border-b border-border",
              isHS && "bg-economia-error/5"
            )}>
              {/* Criterion */}
              <div className="w-[88px] shrink-0">
                <p className="text-xs font-medium text-foreground">{meta.label}</p>
                {isHS && !item.override && (
                  <span className="text-[9px] text-economia-error flex items-center gap-0.5">
                    <Zap className="h-2 w-2" /> Hard Stop
                  </span>
                )}
                {item.override && (
                  <span className="text-[9px] text-economia-warning">↩ override</span>
                )}
              </div>

              {/* ✓ / ✗ */}
              <div className="flex gap-1 shrink-0">
                {([true, false] as const).map(val => (
                  <button key={String(val)}
                    onClick={() => onChange(key, "value", item.value === val ? null : val)}
                    title={meta.hint}
                    className={cn(
                      "h-6 w-6 rounded-lg border text-[9px] font-bold transition-all",
                      item.value === val
                        ? val ? "bg-economia-success/20 border-economia-success/40 text-economia-success"
                               : "bg-economia-error/20  border-economia-error/40  text-economia-error"
                        : "bg-muted border-border text-muted-foreground/30 hover:text-muted-foreground"
                    )}
                  >{val ? "✓" : "✗"}</button>
                ))}
              </div>

              {/* Confidence chips */}
              <div className="flex items-center gap-1 flex-1">
                {CONF_LEVELS.map(lvl => {
                  const sel = item.confidence === lvl.value;
                  return (
                    <button key={lvl.value}
                      onClick={() => onChange(key, "confidence", lvl.value)}
                      className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded border transition-all whitespace-nowrap",
                        sel ? lvl.active : "text-muted-foreground/30 bg-muted/40 border-border hover:bg-muted hover:text-muted-foreground/60"
                      )}
                    >{lvl.label}</button>
                  );
                })}
              </div>

              {/* Override */}
              {isHS && !item.override && (
                <button onClick={() => onChange(key, "override", true)}
                  className="text-[9px] text-economia-warning border border-economia-warning/30 px-1.5 py-0.5 rounded hover:bg-economia-warning/10 shrink-0">
                  Override
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function CompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();

  const [company, setCompany]       = useState<CompanyInfo | null>(null);
  const [docs, setDocs]             = useState<DocSummary[]>([]);
  const [existingCert, setExistingCert] = useState<ExistingCert | null>(null);
  const [loading, setLoading]       = useState(true);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const [findings, setFindings]     = useState<Finding[]>([]);
  const [notes, setNotes]           = useState("");
  const [verdict, setVerdict]       = useState<"" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED">("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const [showNewFinding, setShowNewFinding] = useState(false);
  const [newFinding, setNewFinding] = useState<Omit<Finding, "id">>({
    type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", documentId: undefined,
  });

  const [aiDictamen, setAiDictamen]         = useState<AiDictamen | null>(null);
  const [aiLoading, setAiLoading]           = useState(false);
  const [aiCollapsed, setAiCollapsed]       = useState(false);
  const [dismissedAiFindings, setDismissedAiFindings] = useState<Set<number>>(new Set());

  const [vlap, setVlap] = useState<Vlap>({
    vigencia:    { value: null, confidence: 0, override: false },
    legibilidad: { value: null, confidence: 0, override: false },
    autoria:     { value: null, confidence: 0, override: false },
    pertinencia: { value: null, confidence: 0, override: false },
  });

  const vlapHardStop = VLAP_KEYS.some(k =>
    vlap[k].confidence < HARD_STOP && !vlap[k].override && vlap[k].value !== null
  );
  const vlapScore = VLAP_KEYS.reduce((a, k) => a + vlap[k].confidence, 0) / 4;

  // Cargar datos de la empresa + dictamen IA
  useEffect(() => {
    Promise.all([
      fetch(`/api/companies/${companyId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/companies/${companyId}/certification`).then(r => r.ok ? r.json() : null),
      fetch(`/api/companies/${companyId}/ai-dictamen`).then(r => r.ok ? r.json() : null),
    ]).then(([companyData, certData, aiData]) => {
      if (companyData) setCompany(companyData);
      if (aiData?.dictamen) setAiDictamen(aiData.dictamen);
      if (certData) {
        setDocs(certData.documents ?? []);
        if (certData.cert) {
          const c = certData.cert as ExistingCert;
          setExistingCert(c);
          if (c.requirements?.verdict) setVerdict(c.requirements.verdict as typeof verdict);
          if (c.requirements?.notes)   setNotes(c.requirements.notes);
          if (c.requirements?.vlap) {
            const pv = c.requirements.vlap;
            setVlap(prev => {
              const next = { ...prev };
              for (const k of VLAP_KEYS) { if (pv[k]) next[k] = { ...pv[k] }; }
              return next;
            });
          }
          if (c.requirements?.findings) {
            setFindings(c.requirements.findings.map((f: any) => ({ ...f, id: f.id || crypto.randomUUID() })));
          }
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [companyId]);

  const updateVlap = (key: typeof VLAP_KEYS[number], field: keyof VlapBool, value: any) => {
    setVlap(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const addFinding = () => {
    if (!newFinding.title.trim()) return;
    setFindings(prev => [...prev, { ...newFinding, id: crypto.randomUUID() }]);
    setNewFinding({ type: "OBSERVATION", severity: "MEDIUM", title: "", description: "", documentId: undefined });
    setShowNewFinding(false);
  };

  // Acepta una sugerencia de IA y la agrega a los hallazgos del formulario
  const acceptAiFinding = (idx: number) => {
    const f = aiDictamen?.findings[idx];
    if (!f) return;
    setFindings(prev => [...prev, {
      id: crypto.randomUUID(),
      type: f.type as Finding["type"],
      severity: f.severity as Finding["severity"],
      title: f.title,
      description: `${f.description}${f.recommendation ? `\n\nRecomendación: ${f.recommendation}` : ""}`,
      documentId: f.documentId,
    }]);
    setDismissedAiFindings(prev => new Set([...prev, idx]));
  };

  // Acepta sugerencia V.L.A.P. de IA
  const acceptAiVlap = (key: typeof VLAP_KEYS[number]) => {
    const aiItem = aiDictamen?.vlap?.[key];
    if (!aiItem) return;
    const confidence = Math.min(100, aiItem.confidence);
    setVlap(prev => ({
      ...prev,
      [key]: {
        value: aiItem.suggestion,
        confidence,
        override: false,
      }
    }));
  };

  // Regenerar dictamen IA
  const regenerateAi = async () => {
    setAiLoading(true);
    try {
      await fetch(`/api/companies/${companyId}/ai-dictamen`, { method: "POST" });
      // Poll hasta que esté listo (max 3 min)
      const poll = async (retries = 36) => {
        if (retries === 0) return;
        await new Promise(r => setTimeout(r, 5000));
        const r = await fetch(`/api/companies/${companyId}/ai-dictamen`);
        if (!r.ok) return;
        const data = await r.json();
        if (data.dictamen?.status === "READY") {
          setAiDictamen(data.dictamen);
          setDismissedAiFindings(new Set());
          setAiLoading(false);
        } else if (data.dictamen?.status === "FAILED") {
          setAiDictamen(data.dictamen);
          setAiLoading(false);
        } else {
          poll(retries - 1);
        }
      };
      poll();
    } catch {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!verdict) return;
    if (vlapHardStop && !VLAP_KEYS.every(k => vlap[k].override || vlap[k].confidence >= HARD_STOP)) {
      setError("Hard Stop activo: hay criterios V.L.A.P. con confianza < 85% sin override.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/companies/${companyId}/certification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict, notes,
          findings,
          vlap,
          confidenceScore: Math.round(vlapScore),
          documentIds: docs.map(d => d.id),
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
          <ChevronLeft className="h-4 w-4" /> Cola
        </button>
        <div className="h-4 w-px bg-muted" />
        {loading ? (
          <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-economia-info" />
            <span className="font-heading font-semibold text-foreground text-sm">
              {company?.companyName || company?.name || company?.email}
            </span>
            {company?.track && (
              <span className="text-muted-foreground/50 text-xs">{TRACK_LABEL[company.track] ?? company.track}</span>
            )}
            {existingCert && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-economia-warning/30 bg-economia-warning/10 text-economia-warning">
                Dictamen previo: {existingCert.status}
              </span>
            )}
            <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded-full",
              vlapScore >= HARD_STOP ? "bg-economia-success/10 text-economia-success" : "bg-economia-error/10 text-economia-error"
            )}>
              VLAP {Math.round(vlapScore)}%
            </span>
          </div>
        )}
        <div className="flex-1" />
        {/* Verdict buttons */}
        <div className="flex items-center gap-2">
          {(Object.entries(VERDICT_CONFIG) as [typeof verdict, typeof VERDICT_CONFIG[keyof typeof VERDICT_CONFIG]][])
            .filter(([k]) => k !== "")
            .map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key}
                  onClick={() => setVerdict(verdict === key ? "" : key as typeof verdict)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    verdict === key
                      ? cfg.color + " border-transparent"
                      : "bg-muted border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {cfg.label}
                </button>
              );
            })}
          {(() => {
            const blocked = vlapHardStop && !VLAP_KEYS.every(k => vlap[k].override || vlap[k].confidence >= HARD_STOP);
            const canSave = verdict && !saving && !blocked;
            return (
              <button
                onClick={handleSave}
                disabled={!canSave}
                title={blocked ? "Hard Stop activo: resuelve los criterios V.L.A.P. o añade override" : ""}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  canSave
                    ? "bg-economia-guinda hover:bg-economia-guinda/90 text-primary-foreground"
                    : blocked
                      ? "bg-economia-error/20 text-economia-error/60 cursor-not-allowed border border-economia-error/20"
                      : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Guardando..." : blocked ? "Hard Stop ⚡" : existingCert ? "Actualizar dictamen" : "Emitir dictamen"}
              </button>
            );
          })()}
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 bg-economia-error/10 border-b border-economia-error/20 text-economia-error text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      {vlapHardStop && !error && (
        <div className="px-5 py-1.5 bg-economia-error/5 border-b border-economia-error/10 text-economia-error/70 text-[10px] flex items-center gap-2">
          <Zap className="h-3 w-3" /> Hard Stop activo — criterios V.L.A.P. con confianza &lt; {HARD_STOP}%. Requiere override.
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Documentos analizados */}
        <div className="flex-1 border-r border-border overflow-y-auto">
          <div className="px-4 py-2 bg-card border-b border-border sticky top-0 z-10">
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
              Documentos de la empresa · {docs.length} analizados
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="h-6 w-6 text-muted-foreground/30 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <AlertCircle className="h-10 w-10 text-economia-warning/30" />
              <p className="text-muted-foreground text-sm">No hay documentos analizados aún.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {docs.map(doc => (
                <div key={doc.id}
                  className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      doc.status === "ANALYZED" ? "bg-economia-success/10" : "bg-economia-info/10"
                    )}>
                      <FileText className={cn("h-4 w-4", doc.status === "ANALYZED" ? "text-economia-success" : "text-economia-info")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-economia-info/70 text-[10px] capitalize">{doc.domain?.toLowerCase()}</span>
                        <span className="text-muted-foreground/30 text-[10px]">·</span>
                        <span className={cn("text-[10px] font-medium",
                          doc.status === "ANALYZED" ? "text-economia-success" : "text-economia-warning"
                        )}>
                          {doc.status === "ANALYZED" ? "✓ IA analizado" : doc.status}
                        </span>
                        <span className="text-muted-foreground/30 text-[10px]">·</span>
                        <span className="text-muted-foreground/50 text-[10px]">
                          {new Date(doc.updatedAt).toLocaleDateString("es-MX")}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform shrink-0",
                      expandedDoc === doc.id ? "rotate-180" : ""
                    )} />
                  </button>

                  {/* Secciones PageIndex + PDF viewer */}
                  {expandedDoc === doc.id && (
                    <div className="border-t border-border px-3 py-2 space-y-1">
                      {doc.pageIndices.length > 0 && (
                        <>
                          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2">Índice de secciones (IA)</p>
                          {doc.pageIndices.map(idx => (
                            <div key={idx.id} className="flex items-baseline gap-2"
                              style={{ paddingLeft: `${(idx.level - 1) * 12}px` }}>
                              <span className="text-economia-info/70 text-[10px]">
                                {idx.page ? `p.${idx.page}` : "—"}
                              </span>
                              <span className="text-foreground/80 text-[11px] truncate">{idx.title}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                        <a href={`/dashboard/documents/${doc.id}/qa`}
                          target="_blank"
                          className="text-[10px] text-economia-info hover:underline">
                          Q&A →
                        </a>
                        <a href={`/dashboard/documents/${doc.id}/graph`}
                          target="_blank"
                          className="text-[10px] text-economia-success hover:underline">
                          Grafo →
                        </a>
                        <a href={`/dashboard/documents/${doc.id}?from=review&companyId=${companyId}`}
                          target="_blank"
                          className="text-[10px] text-muted-foreground hover:underline">
                          Detalle →
                        </a>
                      </div>
                      <PdfInlineViewer
                        url={doc.storageUrl ?? ""}
                        height="60vh"
                        className="mt-2"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Formulario de auditoría */}
        <div className="w-[440px] flex flex-col bg-economia-verdeDark border-l border-border overflow-hidden shrink-0">
          <div className="px-4 py-2 bg-card border-b border-border shrink-0">
            <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">Formulario de Auditoría — Dictamen Empresa</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* ── Panel Dictamen IA ── */}
            <div className="rounded-xl border border-economia-info/20 bg-economia-info/5 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-economia-info/10 transition-colors"
                onClick={() => setAiCollapsed(p => !p)}
              >
                <Sparkles className="h-3.5 w-3.5 text-economia-info shrink-0" />
                <span className="text-xs font-semibold text-economia-info flex-1 text-left">
                  Análisis Preliminar IA
                </span>
                {aiDictamen?.status === "READY" && (
                  <span className="text-[9px] bg-economia-info/20 text-economia-info px-1.5 py-0.5 rounded-full font-medium">
                    {aiDictamen.findings.length - dismissedAiFindings.size} hallazgos pendientes
                  </span>
                )}
                {(!aiDictamen || aiDictamen.status === "GENERATING") && (
                  <span className="text-[9px] text-muted-foreground/50">
                    {aiLoading || aiDictamen?.status === "GENERATING" ? "Generando…" : "Sin datos"}
                  </span>
                )}
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground/50 transition-transform", !aiCollapsed && "rotate-180")} />
              </button>

              {!aiCollapsed && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Estado generando */}
                  {(!aiDictamen || aiDictamen.status === "GENERATING") && (
                    <div className="flex items-center gap-2 py-3 text-muted-foreground/50 text-xs">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Generando análisis IA… puede tardar 1-2 minutos.
                      <button onClick={regenerateAi} disabled={aiLoading}
                        className="ml-auto text-economia-info hover:underline text-[10px]">
                        {aiLoading ? "Regenerando…" : "Reintentar"}
                      </button>
                    </div>
                  )}

                  {/* Error */}
                  {aiDictamen?.status === "FAILED" && (
                    <div className="flex items-center gap-2 py-2 text-economia-error text-xs">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Error al generar: {aiDictamen.errorMsg || "desconocido"}</span>
                      <button onClick={regenerateAi} disabled={aiLoading}
                        className="ml-auto text-economia-info hover:underline text-[10px]">
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* Listo */}
                  {aiDictamen?.status === "READY" && (
                    <>
                      {/* Resumen */}
                      {aiDictamen.summary && (
                        <p className="text-[10px] text-muted-foreground leading-relaxed border-b border-border pb-2">
                          {aiDictamen.summary}
                        </p>
                      )}

                      {/* Sugerencias V.L.A.P. */}
                      {aiDictamen.vlap && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground/70 mb-1.5 uppercase tracking-wider">
                            Sugerencias V.L.A.P.
                          </p>
                          <div className="space-y-1">
                            {VLAP_KEYS.map(k => {
                              const item = aiDictamen.vlap?.[k];
                              if (!item) return null;
                              return (
                                <div key={k} className="flex items-center gap-2 text-[10px]">
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                                    item.suggestion === true  ? "bg-economia-success" :
                                    item.suggestion === false ? "bg-economia-error"   : "bg-muted-foreground/30"
                                  )} />
                                  <span className="text-foreground/70 w-16 shrink-0 capitalize">{k}</span>
                                  <span className="text-muted-foreground/50 flex-1 truncate" title={item.rationale}>
                                    {item.rationale}
                                  </span>
                                  <span className="text-muted-foreground/40 shrink-0">{item.confidence}%</span>
                                  <button onClick={() => acceptAiVlap(k)}
                                    className="shrink-0 text-economia-info hover:text-economia-success text-[9px] border border-economia-info/30 px-1.5 py-0.5 rounded hover:bg-economia-success/10 transition-colors">
                                    Aplicar
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Hallazgos sugeridos */}
                      {aiDictamen.findings.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                              Hallazgos Sugeridos
                            </p>
                            <button
                              onClick={() => {
                                aiDictamen.findings.forEach((_, i) => {
                                  if (!dismissedAiFindings.has(i)) acceptAiFinding(i);
                                });
                              }}
                              className="text-[9px] text-economia-info hover:underline"
                            >
                              Aceptar todos
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {aiDictamen.findings.map((f, i) => {
                              if (dismissedAiFindings.has(i)) return null;
                              const sev  = SEVERITIES.find(s => s.id === f.severity);
                              const type = FINDING_TYPES.find(t => t.id === f.type);
                              return (
                                <div key={i} className="flex items-start gap-2 bg-card border border-border rounded-lg p-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                      <span className={cn("text-[9px] font-medium", type?.color)}>{type?.label}</span>
                                      <span className={cn("text-[9px] px-1 rounded", sev?.color)}>{sev?.label}</span>
                                      {f.documentName && (
                                        <span className="text-[9px] text-muted-foreground/40 truncate">{f.documentName}</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-foreground/80 font-medium truncate">{f.title}</p>
                                    <p className="text-[9px] text-muted-foreground/50 line-clamp-2">{f.description}</p>
                                  </div>
                                  <div className="flex flex-col gap-1 shrink-0">
                                    <button onClick={() => acceptAiFinding(i)}
                                      title="Agregar al dictamen"
                                      className="p-1 rounded hover:bg-economia-success/20 text-muted-foreground/40 hover:text-economia-success transition-colors">
                                      <CheckCheck className="h-3 w-3" />
                                    </button>
                                    <button onClick={() => setDismissedAiFindings(prev => new Set([...prev, i]))}
                                      title="Descartar sugerencia"
                                      className="p-1 rounded hover:bg-economia-error/20 text-muted-foreground/40 hover:text-economia-error transition-colors">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <button onClick={regenerateAi} disabled={aiLoading}
                        className="text-[9px] text-muted-foreground/40 hover:text-economia-info flex items-center gap-1 mt-1">
                        <RefreshCw className={cn("h-2.5 w-2.5", aiLoading && "animate-spin")} />
                        Regenerar análisis
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* V.L.A.P. */}
            <VlapPanel vlap={vlap} onChange={updateVlap} />

            {/* Hallazgos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-economia-warning" /> Hallazgos
                  {findings.length > 0 && (
                    <span className="bg-economia-warning text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{findings.length}</span>
                  )}
                  {ncCount > 0 && (
                    <span className="bg-economia-error/20 text-economia-error text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" /> {ncCount} NC → CAPA
                    </span>
                  )}
                </span>
                <button onClick={() => setShowNewFinding(!showNewFinding)}
                  className="flex items-center gap-1 text-[10px] text-economia-guinda hover:text-economia-success">
                  <Plus className="h-3 w-3" /> Añadir
                </button>
              </div>

              {showNewFinding && (
                <div className="bg-card border border-economia-warning/20 rounded-xl p-3 mb-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Tipo</label>
                      <select value={newFinding.type}
                        onChange={e => setNewFinding(p => ({ ...p, type: e.target.value as Finding["type"] }))}
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground focus:outline-none">
                        {FINDING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Severidad</label>
                      <select value={newFinding.severity}
                        onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value as Finding["severity"] }))}
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground focus:outline-none">
                        {SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Documento relacionado */}
                  {docs.length > 0 && (
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">Documento relacionado</label>
                      <select value={newFinding.documentId ?? ""}
                        onChange={e => setNewFinding(p => ({ ...p, documentId: e.target.value || undefined }))}
                        className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground focus:outline-none">
                        <option value="">— Ninguno específico —</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Título del hallazgo</label>
                    <input type="text" value={newFinding.title}
                      onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Falta certificación vigente..."
                      className="w-full h-7 px-2 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none focus:border-economia-warning" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Descripción</label>
                    <textarea value={newFinding.description}
                      onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                      rows={2} placeholder="Detalla el hallazgo..."
                      className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none focus:border-economia-warning resize-none" />
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setShowNewFinding(false)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground">
                      Cancelar
                    </button>
                    <button onClick={addFinding} disabled={!newFinding.title.trim()}
                      className="px-3 py-1.5 text-xs bg-economia-warning hover:bg-economia-warning/90 text-black font-medium rounded-lg disabled:opacity-40">
                      Agregar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {findings.map(f => {
                  const sev  = SEVERITIES.find(s => s.id === f.severity)!;
                  const type = FINDING_TYPES.find(t => t.id === f.type)!;
                  const docName = docs.find(d => d.id === f.documentId)?.name;
                  return (
                    <div key={f.id} className={cn(
                      "bg-card border rounded-xl p-3",
                      f.type === "NON_COMPLIANCE" ? "border-economia-error/20" : "border-border"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[9px] font-medium", type?.color)}>{type?.label}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", sev?.color)}>{sev?.label}</span>
                          {docName && <span className="text-[9px] text-muted-foreground/50 truncate max-w-[120px]">{docName}</span>}
                          {f.type === "NON_COMPLIANCE" && (
                            <span className="text-[9px] text-economia-error/70">→ CAPA 30d</span>
                          )}
                        </div>
                        <button onClick={() => setFindings(prev => prev.filter(x => x.id !== f.id))}
                          className="text-muted-foreground/30 hover:text-economia-error shrink-0">
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

            {/* Notas */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-economia-info" /> Notas para la Empresa
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Comentarios que verá la empresa: contexto, qué debe corregir, plazos, etc."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-card border border-border rounded-xl text-foreground placeholder-white/20 focus:outline-none focus:border-economia-info resize-none" />
            </div>

            {/* Resumen */}
            {verdict && (
              <div className={cn("rounded-xl p-3 text-xs font-medium space-y-1",
                verdict === "APPROVED"          ? "bg-economia-success/10  border border-economia-success/20"  :
                verdict === "CHANGES_REQUESTED" ? "bg-economia-warning/10 border border-economia-warning/20" :
                                                  "bg-economia-error/10   border border-economia-error/20"
              )}>
                <div className="flex items-center gap-2">
                  {verdict === "APPROVED" && <CheckCircle className="h-4 w-4 text-economia-success shrink-0" />}
                  {verdict === "CHANGES_REQUESTED" && <MessageSquare className="h-4 w-4 text-economia-warning shrink-0" />}
                  {verdict === "REJECTED" && <XCircle className="h-4 w-4 text-economia-error shrink-0" />}
                  <span className={verdict==="APPROVED" ? "text-economia-success" : verdict==="CHANGES_REQUESTED" ? "text-economia-warning" : "text-economia-error"}>
                    {verdict==="APPROVED" ? "Empresa aprobada" : verdict==="CHANGES_REQUESTED" ? "Se requieren cambios" : "Empresa rechazada"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground/60 text-[10px]">
                  <span>Score VLAP: <strong className="text-foreground">{Math.round(vlapScore)}%</strong></span>
                  <span>{docs.length} doc{docs.length !== 1 ? "s" : ""} evaluado{docs.length !== 1 ? "s" : ""}</span>
                  {ncCount > 0 && <span className="text-economia-warning">{ncCount} CAPA ticket{ncCount !== 1 ? "s" : ""}</span>}
                  {verdict === "APPROVED" && <span className="text-economia-info flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Certificado SHA-256</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
