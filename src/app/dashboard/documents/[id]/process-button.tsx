"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessDocumentButtonProps {
  documentId: string;
  currentDomain: string;
  currentStatus: string;
}

type ExtractionMode = 'auto' | 'directed' | 'mixed';

const MODE_LABELS: Record<ExtractionMode, { icon: string; label: string; desc: string }> = {
  auto:     { icon: '🤖', label: 'Automático',  desc: 'El LLM decide qué extraer según el dominio' },
  mixed:    { icon: '🔀', label: 'Mixto',        desc: 'Dominio base + temas/tipos que especifiques' },
  directed: { icon: '🎯', label: 'Dirigido',     desc: 'Solo extrae lo que especifiques tú' },
};

export default function ProcessDocumentButton({
  documentId,
  currentDomain,
  currentStatus,
}: ProcessDocumentButtonProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [domain, setDomain] = useState(currentDomain || "INDUSTRIA");
  const [mode, setMode] = useState<ExtractionMode>('auto');
  const [showConfig, setShowConfig] = useState(false);

  // Campos de configuración dirigida / mixta
  const [focusTopics, setFocusTopics] = useState('');
  const [customEntityTypes, setCustomEntityTypes] = useState('');
  const [customRelationTypes, setCustomRelationTypes] = useState('');
  const [instructions, setInstructions] = useState('');

  const handleProcess = async () => {
    const modeInfo = MODE_LABELS[mode];
    const summary = mode === 'auto'
      ? `dominio ${domain}, modo automático`
      : `dominio ${domain}, modo ${modeInfo.label}`;

    if (!confirm(`¿Procesar documento con ${summary}? Esto puede tomar varios minutos.`)) return;

    setProcessing(true);
    try {
      const extractionConfig = mode === 'auto' ? { mode } : {
        mode,
        ...(focusTopics.trim() ? { focusTopics: focusTopics.trim() } : {}),
        ...(customEntityTypes.trim() ? { customEntityTypes: customEntityTypes.trim() } : {}),
        ...(customRelationTypes.trim() ? { customRelationTypes: customRelationTypes.trim() } : {}),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      };

      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, extractionConfig }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Documento procesado exitosamente!\n\nEntidades: ${result.document.entities}\nÍndices: ${result.document.indices}\nTiempo: ${result.document.duration}s`);
        router.refresh();
      } else {
        alert(`❌ Error al procesar: ${result.error || result.message}`);
      }
    } catch (error: any) {
      alert(`Error al procesar documento: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const isPendingOrFailed = currentStatus === "PENDING" || currentStatus === "FAILED";
  const needsConfig = mode !== 'auto';

  return (
    <div className={cn(
      "bg-card rounded-2xl p-5 h-full flex flex-col",
      isPendingOrFailed ? "border border-economia-warning/30" : "border border-border"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
        isPendingOrFailed ? "bg-economia-warning/10" : "bg-economia-gris/10"
      )}>
        <Brain className={cn("h-5 w-5", isPendingOrFailed ? "text-economia-warning" : "text-muted-foreground")} />
      </div>
      <h3 className="font-heading font-semibold text-foreground mb-1">Procesar Documento</h3>
      <p className="text-muted-foreground text-xs mb-4 flex-1">Ejecuta el análisis de IA manualmente</p>

      <div className="space-y-3">
        {/* Dominio */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Dominio de análisis:</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={processing}
            className="w-full h-8 px-2 border border-border rounded-lg text-sm bg-muted text-foreground focus:outline-none focus:border-economia-guinda disabled:opacity-50"
          >
            <option value="INDUSTRIA">🏭 Industria</option>
            <option value="CONSTRUCCION">🏗️ Construcción</option>
            <option value="TECNOLOGIA">💻 Tecnología / Servicios</option>
          </select>
        </div>

        {/* Modo de extracción */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Modo de extracción del grafo:</label>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(MODE_LABELS) as ExtractionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); if (m !== 'auto') setShowConfig(true); }}
                disabled={processing}
                title={MODE_LABELS[m].desc}
                className={cn(
                  "py-1.5 px-1 rounded-lg text-xs font-medium transition-colors border",
                  mode === m
                    ? "bg-economia-guinda/20 border-economia-guinda/50 text-economia-guinda"
                    : "bg-muted border-border text-muted-foreground hover:border-border"
                )}
              >
                {MODE_LABELS[m].icon} {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground/60 text-[10px] mt-1">{MODE_LABELS[mode].desc}</p>
        </div>

        {/* Config expandible para directed/mixed */}
        {needsConfig && (
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Configuración de extracción</span>
              {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showConfig && (
              <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2.5">
                {/* Temas de enfoque */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    Temas a enfocar <span className="text-foreground/30">(separados por coma)</span>
                  </label>
                  <input
                    type="text"
                    value={focusTopics}
                    onChange={(e) => setFocusTopics(e.target.value)}
                    disabled={processing}
                    placeholder="ej: diagnóstico de piel, rituales de pureza"
                    className="w-full h-7 px-2 text-xs border border-border rounded-lg bg-muted text-foreground placeholder-white/20 focus:outline-none focus:border-economia-guinda disabled:opacity-50"
                  />
                </div>

                {/* Tipos de entidad personalizados */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    Tipos de entidad extra <span className="text-foreground/30">(uno por línea: TIPO: descripción)</span>
                  </label>
                  <textarea
                    value={customEntityTypes}
                    onChange={(e) => setCustomEntityTypes(e.target.value)}
                    disabled={processing}
                    placeholder={"RITUAL: Ritual o ceremonia religiosa\nPRIEST: Sacerdote o líder religioso"}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-muted text-foreground placeholder-white/20 focus:outline-none focus:border-economia-guinda disabled:opacity-50 resize-none font-mono"
                  />
                </div>

                {/* Tipos de relación personalizados */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    Tipos de relación extra <span className="text-foreground/30">(uno por línea: TIPO: descripción)</span>
                  </label>
                  <textarea
                    value={customRelationTypes}
                    onChange={(e) => setCustomRelationTypes(e.target.value)}
                    disabled={processing}
                    placeholder={"PURIFIES: Purifica a persona\nDIAGNOSES: Diagnóstica condición"}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-muted text-foreground placeholder-white/20 focus:outline-none focus:border-economia-guinda disabled:opacity-50 resize-none font-mono"
                  />
                </div>

                {/* Instrucciones adicionales */}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">
                    Instrucciones adicionales <span className="text-foreground/30">(texto libre)</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={processing}
                    placeholder="ej: presta especial atención a los procedimientos descritos en cada versículo"
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-muted text-foreground placeholder-white/20 focus:outline-none focus:border-economia-guinda disabled:opacity-50 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={processing}
          className={cn(
            "w-full flex items-center justify-center gap-2 font-medium text-sm py-2 rounded-xl transition-colors disabled:opacity-50",
            isPendingOrFailed
              ? "bg-economia-warning hover:bg-economia-warning/90 text-primary-foreground"
              : "border border-border hover:border-economia-guinda/40 text-foreground",
            processing && "animate-pulse"
          )}
        >
          {processing ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Procesando...</>
          ) : (
            <><Brain className="h-4 w-4" /> {isPendingOrFailed ? "Procesar" : "Reprocesar"}</>
          )}
        </button>
      </div>
    </div>
  );
}
