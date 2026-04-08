"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, MessageSquare, ChevronLeft,
  Flag, Plus, Trash2, RefreshCw, AlertCircle, FileText,
  ShieldCheck, ShieldAlert, Clock, Zap, Building2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  id: string; name: string; status: string; domain: string; updatedAt: string;
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

const FINDING_TYPES = [
  { id: "COMPLIANCE",     label: "Cumplimiento",   color: "text-cetiem-lime"  },
  { id: "NON_COMPLIANCE", label: "No Conformidad",  color: "text-cetiem-red"   },
  { id: "OBSERVATION",    label: "Observación",    color: "text-cetiem-amber" },
];
const SEVERITIES = [
  { id: "LOW",      label: "Bajo",    color: "bg-cetiem-teal/20   text-cetiem-teal"  },
  { id: "MEDIUM",   label: "Medio",   color: "bg-cetiem-amber/20  text-cetiem-amber" },
  { id: "HIGH",     label: "Alto",    color: "bg-cetiem-red/20    text-cetiem-red"   },
  { id: "CRITICAL", label: "Crítico", color: "bg-cetiem-red/40    text-cetiem-red font-bold" },
];
const VERDICT_CONFIG = {
  APPROVED:          { label: "Aprobar",          icon: CheckCircle,   color: "bg-cetiem-lime  hover:bg-cetiem-lime/90  text-black" },
  CHANGES_REQUESTED: { label: "Solicitar Cambios", icon: MessageSquare, color: "bg-cetiem-amber hover:bg-cetiem-amber/90 text-black" },
  REJECTED:          { label: "Rechazar",          icon: XCircle,      color: "bg-cetiem-red   hover:bg-cetiem-red/90   text-white" },
};
const TRACK_LABEL: Record<string, string> = {
  A: "Track A — Industria", B: "Track B — Construcción", C: "Track C — Tecnología",
};

/* Confidence chip levels — replaces slider */
const CONF_LEVELS = [
  { label: "–",       value: 0,   active: "text-cetiem-gray/50 bg-white/8       border-white/15" },
  { label: "Bajo",    value: 60,  active: "text-cetiem-red     bg-cetiem-red/15   border-cetiem-red/30" },
  { label: "Parcial", value: 75,  active: "text-cetiem-amber   bg-cetiem-amber/15 border-cetiem-amber/30" },
  { label: "≥85%",    value: 88,  active: "text-cetiem-lime    bg-cetiem-lime/15  border-cetiem-lime/30" },
  { label: "Pleno",   value: 100, active: "text-cetiem-lime    bg-cetiem-lime/20  border-cetiem-lime/40" },
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
        <ShieldCheck className="h-3.5 w-3.5 text-cetiem-teal" />
        <span className="text-xs font-semibold text-white">Motor V.L.A.P.</span>
        {hasHardStop && (
          <span className="text-[9px] font-bold bg-cetiem-red/20 text-cetiem-red px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" /> Hard Stop
          </span>
        )}
        {!hasHardStop && allPassed && (
          <span className="text-[9px] font-bold bg-cetiem-lime/20 text-cetiem-lime px-1.5 py-0.5 rounded-full">✓ OK</span>
        )}
      </div>

      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        {VLAP_KEYS.map((key, i) => {
          const item = vlap[key];
          const meta = VLAP_LABELS[key];
          const isHS = item.confidence < HARD_STOP && !item.override && item.value !== null && item.confidence > 0;
          return (
            <div key={key} className={cn(
              "flex items-center gap-2 px-3 py-2.5",
              i < VLAP_KEYS.length - 1 && "border-b border-white/5",
              isHS && "bg-cetiem-red/5"
            )}>
              {/* Criterion */}
              <div className="w-[88px] shrink-0">
                <p className="text-xs font-medium text-white">{meta.label}</p>
                {isHS && !item.override && (
                  <span className="text-[9px] text-cetiem-red flex items-center gap-0.5">
                    <Zap className="h-2 w-2" /> Hard Stop
                  </span>
                )}
                {item.override && (
                  <span className="text-[9px] text-cetiem-amber">↩ override</span>
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
                        ? val ? "bg-cetiem-lime/20 border-cetiem-lime/40 text-cetiem-lime"
                               : "bg-cetiem-red/20  border-cetiem-red/40  text-cetiem-red"
                        : "bg-white/5 border-white/10 text-cetiem-gray/30 hover:text-cetiem-gray"
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
                        sel ? lvl.active : "text-cetiem-gray/30 bg-white/3 border-white/8 hover:bg-white/8 hover:text-cetiem-gray/60"
                      )}
                    >{lvl.label}</button>
                  );
                })}
              </div>

              {/* Override */}
              {isHS && !item.override && (
                <button onClick={() => onChange(key, "override", true)}
                  className="text-[9px] text-cetiem-amber border border-cetiem-amber/30 px-1.5 py-0.5 rounded hover:bg-cetiem-amber/10 shrink-0">
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

  // Cargar datos de la empresa
  useEffect(() => {
    Promise.all([
      fetch(`/api/companies/${companyId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/companies/${companyId}/certification`).then(r => r.ok ? r.json() : null),
    ]).then(([companyData, certData]) => {
      if (companyData) setCompany(companyData);
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
      <div className="flex items-center gap-4 px-5 py-3 bg-cetiem-card border-b border-white/5 shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-cetiem-gray hover:text-white text-sm transition-colors">
          <ChevronLeft className="h-4 w-4" /> Cola
        </button>
        <div className="h-4 w-px bg-white/10" />
        {loading ? (
          <div className="h-4 w-40 bg-white/5 rounded animate-pulse" />
        ) : (
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 text-cetiem-teal" />
            <span className="font-heading font-semibold text-white text-sm">
              {company?.companyName || company?.name || company?.email}
            </span>
            {company?.track && (
              <span className="text-cetiem-gray/50 text-xs">{TRACK_LABEL[company.track] ?? company.track}</span>
            )}
            {existingCert && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-cetiem-amber/30 bg-cetiem-amber/10 text-cetiem-amber">
                Dictamen previo: {existingCert.status}
              </span>
            )}
            <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded-full",
              vlapScore >= HARD_STOP ? "bg-cetiem-lime/10 text-cetiem-lime" : "bg-cetiem-red/10 text-cetiem-red"
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
                      : "bg-white/5 border-white/10 text-cetiem-gray hover:text-white"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {cfg.label}
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
            {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Guardando..." : existingCert ? "Actualizar dictamen" : "Emitir dictamen"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-5 py-2 bg-cetiem-red/10 border-b border-cetiem-red/20 text-cetiem-red text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
      {vlapHardStop && !error && (
        <div className="px-5 py-1.5 bg-cetiem-red/5 border-b border-cetiem-red/10 text-cetiem-red/70 text-[10px] flex items-center gap-2">
          <Zap className="h-3 w-3" /> Hard Stop activo — criterios V.L.A.P. con confianza &lt; {HARD_STOP}%. Requiere override.
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Documentos analizados */}
        <div className="flex-1 border-r border-white/5 overflow-y-auto">
          <div className="px-4 py-2 bg-cetiem-card border-b border-white/5 sticky top-0 z-10">
            <span className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest">
              Documentos de la empresa · {docs.length} analizados
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="h-6 w-6 text-cetiem-gray/30 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <AlertCircle className="h-10 w-10 text-cetiem-amber/30" />
              <p className="text-cetiem-gray text-sm">No hay documentos analizados aún.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {docs.map(doc => (
                <div key={doc.id}
                  className="bg-cetiem-card border border-white/5 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                  >
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                      doc.status === "ANALYZED" ? "bg-cetiem-lime/10" : "bg-cetiem-teal/10"
                    )}>
                      <FileText className={cn("h-4 w-4", doc.status === "ANALYZED" ? "text-cetiem-lime" : "text-cetiem-teal")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-cetiem-teal/70 text-[10px] capitalize">{doc.domain?.toLowerCase()}</span>
                        <span className="text-cetiem-gray/30 text-[10px]">·</span>
                        <span className={cn("text-[10px] font-medium",
                          doc.status === "ANALYZED" ? "text-cetiem-lime" : "text-cetiem-amber"
                        )}>
                          {doc.status === "ANALYZED" ? "✓ IA analizado" : doc.status}
                        </span>
                        <span className="text-cetiem-gray/30 text-[10px]">·</span>
                        <span className="text-cetiem-gray/50 text-[10px]">
                          {new Date(doc.updatedAt).toLocaleDateString("es-MX")}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-cetiem-gray/40 transition-transform shrink-0",
                      expandedDoc === doc.id ? "rotate-180" : ""
                    )} />
                  </button>

                  {/* Secciones PageIndex */}
                  {expandedDoc === doc.id && doc.pageIndices.length > 0 && (
                    <div className="border-t border-white/5 px-3 py-2 space-y-1">
                      <p className="text-[10px] text-cetiem-gray/50 uppercase tracking-widest mb-2">Índice de secciones (IA)</p>
                      {doc.pageIndices.map(idx => (
                        <div key={idx.id} className="flex items-baseline gap-2"
                          style={{ paddingLeft: `${(idx.level - 1) * 12}px` }}>
                          <span className="text-cetiem-teal/70 text-[10px]">
                            {idx.page ? `p.${idx.page}` : "—"}
                          </span>
                          <span className="text-white/80 text-[11px] truncate">{idx.title}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/5 flex gap-2">
                        <a href={`/dashboard/documents/${doc.id}/qa`}
                          target="_blank"
                          className="text-[10px] text-cetiem-teal hover:underline">
                          Q&A →
                        </a>
                        <a href={`/dashboard/documents/${doc.id}/graph`}
                          target="_blank"
                          className="text-[10px] text-cetiem-lime hover:underline">
                          Grafo →
                        </a>
                        <a href={`/dashboard/documents/${doc.id}`}
                          target="_blank"
                          className="text-[10px] text-cetiem-gray hover:underline">
                          Detalle →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Formulario de auditoría */}
        <div className="w-[440px] flex flex-col bg-cetiem-dark border-l border-white/5 overflow-hidden shrink-0">
          <div className="px-4 py-2 bg-cetiem-card border-b border-white/5 shrink-0">
            <span className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest">Formulario de Auditoría — Dictamen Empresa</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* V.L.A.P. */}
            <VlapPanel vlap={vlap} onChange={updateVlap} />

            {/* Hallazgos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5 text-cetiem-amber" /> Hallazgos
                  {findings.length > 0 && (
                    <span className="bg-cetiem-amber text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{findings.length}</span>
                  )}
                  {ncCount > 0 && (
                    <span className="bg-cetiem-red/20 text-cetiem-red text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" /> {ncCount} NC → CAPA
                    </span>
                  )}
                </span>
                <button onClick={() => setShowNewFinding(!showNewFinding)}
                  className="flex items-center gap-1 text-[10px] text-cetiem-green hover:text-cetiem-lime">
                  <Plus className="h-3 w-3" /> Añadir
                </button>
              </div>

              {showNewFinding && (
                <div className="bg-cetiem-card border border-cetiem-amber/20 rounded-xl p-3 mb-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Tipo</label>
                      <select value={newFinding.type}
                        onChange={e => setNewFinding(p => ({ ...p, type: e.target.value as Finding["type"] }))}
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none">
                        {FINDING_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Severidad</label>
                      <select value={newFinding.severity}
                        onChange={e => setNewFinding(p => ({ ...p, severity: e.target.value as Finding["severity"] }))}
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none">
                        {SEVERITIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Documento relacionado */}
                  {docs.length > 0 && (
                    <div>
                      <label className="text-[10px] text-cetiem-gray mb-1 block">Documento relacionado</label>
                      <select value={newFinding.documentId ?? ""}
                        onChange={e => setNewFinding(p => ({ ...p, documentId: e.target.value || undefined }))}
                        className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none">
                        <option value="">— Ninguno específico —</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-cetiem-gray mb-1 block">Título del hallazgo</label>
                    <input type="text" value={newFinding.title}
                      onChange={e => setNewFinding(p => ({ ...p, title: e.target.value }))}
                      placeholder="Ej: Falta certificación vigente..."
                      className="w-full h-7 px-2 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-cetiem-amber" />
                  </div>
                  <div>
                    <label className="text-[10px] text-cetiem-gray mb-1 block">Descripción</label>
                    <textarea value={newFinding.description}
                      onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))}
                      rows={2} placeholder="Detalla el hallazgo..."
                      className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-cetiem-amber resize-none" />
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setShowNewFinding(false)}
                      className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-cetiem-gray hover:text-white">
                      Cancelar
                    </button>
                    <button onClick={addFinding} disabled={!newFinding.title.trim()}
                      className="px-3 py-1.5 text-xs bg-cetiem-amber hover:bg-cetiem-amber/90 text-black font-medium rounded-lg disabled:opacity-40">
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
                      "bg-cetiem-card border rounded-xl p-3",
                      f.type === "NON_COMPLIANCE" ? "border-cetiem-red/20" : "border-white/5"
                    )}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn("text-[9px] font-medium", type?.color)}>{type?.label}</span>
                          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", sev?.color)}>{sev?.label}</span>
                          {docName && <span className="text-[9px] text-cetiem-gray/50 truncate max-w-[120px]">{docName}</span>}
                          {f.type === "NON_COMPLIANCE" && (
                            <span className="text-[9px] text-cetiem-red/70">→ CAPA 30d</span>
                          )}
                        </div>
                        <button onClick={() => setFindings(prev => prev.filter(x => x.id !== f.id))}
                          className="text-cetiem-gray/30 hover:text-cetiem-red shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-white text-xs font-medium">{f.title}</p>
                      {f.description && <p className="text-cetiem-gray/60 text-[10px] mt-0.5 leading-relaxed">{f.description}</p>}
                    </div>
                  );
                })}
                {findings.length === 0 && !showNewFinding && (
                  <p className="text-cetiem-gray/30 text-xs text-center py-4">Sin hallazgos añadidos</p>
                )}
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-cetiem-teal" /> Notas para la Empresa
              </label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Comentarios que verá la empresa: contexto, qué debe corregir, plazos, etc."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-cetiem-card border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-cetiem-teal resize-none" />
            </div>

            {/* Resumen */}
            {verdict && (
              <div className={cn("rounded-xl p-3 text-xs font-medium space-y-1",
                verdict === "APPROVED"          ? "bg-cetiem-lime/10  border border-cetiem-lime/20"  :
                verdict === "CHANGES_REQUESTED" ? "bg-cetiem-amber/10 border border-cetiem-amber/20" :
                                                  "bg-cetiem-red/10   border border-cetiem-red/20"
              )}>
                <div className="flex items-center gap-2">
                  {verdict === "APPROVED" && <CheckCircle className="h-4 w-4 text-cetiem-lime shrink-0" />}
                  {verdict === "CHANGES_REQUESTED" && <MessageSquare className="h-4 w-4 text-cetiem-amber shrink-0" />}
                  {verdict === "REJECTED" && <XCircle className="h-4 w-4 text-cetiem-red shrink-0" />}
                  <span className={verdict==="APPROVED" ? "text-cetiem-lime" : verdict==="CHANGES_REQUESTED" ? "text-cetiem-amber" : "text-cetiem-red"}>
                    {verdict==="APPROVED" ? "Empresa aprobada" : verdict==="CHANGES_REQUESTED" ? "Se requieren cambios" : "Empresa rechazada"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-cetiem-gray/60 text-[10px]">
                  <span>Score VLAP: <strong className="text-white">{Math.round(vlapScore)}%</strong></span>
                  <span>{docs.length} doc{docs.length !== 1 ? "s" : ""} evaluado{docs.length !== 1 ? "s" : ""}</span>
                  {ncCount > 0 && <span className="text-cetiem-amber">{ncCount} CAPA ticket{ncCount !== 1 ? "s" : ""}</span>}
                  {verdict === "APPROVED" && <span className="text-cetiem-teal flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Certificado SHA-256</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
