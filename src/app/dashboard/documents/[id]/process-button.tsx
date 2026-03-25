"use client";

import { useState } from "react";
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
        window.location.reload();
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
      "bg-cetiem-card rounded-2xl p-5 h-full flex flex-col",
      isPendingOrFailed ? "border border-cetiem-amber/30" : "border border-white/5"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
        isPendingOrFailed ? "bg-cetiem-amber/10" : "bg-cetiem-gray/10"
      )}>
        <Brain className={cn("h-5 w-5", isPendingOrFailed ? "text-cetiem-amber" : "text-cetiem-gray")} />
      </div>
      <h3 className="font-heading font-semibold text-white mb-1">Procesar Documento</h3>
      <p className="text-cetiem-gray text-xs mb-4 flex-1">Ejecuta PageIndex + Cognee manualmente</p>

      <div className="space-y-3">
        {/* Dominio */}
        <div>
          <label className="text-xs text-cetiem-gray mb-1 block">Dominio de análisis:</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={processing}
            className="w-full h-8 px-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:outline-none focus:border-cetiem-green disabled:opacity-50"
          >
            <option value="INDUSTRIA">🏭 Industria</option>
            <option value="CONSTRUCCION">🏗️ Construcción</option>
            <option value="TECNOLOGIA">💻 Tecnología / Servicios</option>
          </select>
        </div>

        {/* Modo de extracción */}
        <div>
          <label className="text-xs text-cetiem-gray mb-1 block">Modo de extracción del grafo:</label>
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
                    ? "bg-cetiem-green/20 border-cetiem-green/50 text-cetiem-green"
                    : "bg-white/5 border-white/10 text-cetiem-gray hover:border-white/20"
                )}
              >
                {MODE_LABELS[m].icon} {MODE_LABELS[m].label}
              </button>
            ))}
          </div>
          <p className="text-cetiem-gray/60 text-[10px] mt-1">{MODE_LABELS[mode].desc}</p>
        </div>

        {/* Config expandible para directed/mixed */}
        {needsConfig && (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-cetiem-gray hover:text-white transition-colors"
            >
              <span>Configuración de extracción</span>
              {showConfig ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showConfig && (
              <div className="px-3 pb-3 space-y-2.5 border-t border-white/10 pt-2.5">
                {/* Temas de enfoque */}
                <div>
                  <label className="text-[10px] text-cetiem-gray mb-1 block">
                    Temas a enfocar <span className="text-white/30">(separados por coma)</span>
                  </label>
                  <input
                    type="text"
                    value={focusTopics}
                    onChange={(e) => setFocusTopics(e.target.value)}
                    disabled={processing}
                    placeholder="ej: diagnóstico de piel, rituales de pureza"
                    className="w-full h-7 px-2 text-xs border border-white/10 rounded-lg bg-white/5 text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green disabled:opacity-50"
                  />
                </div>

                {/* Tipos de entidad personalizados */}
                <div>
                  <label className="text-[10px] text-cetiem-gray mb-1 block">
                    Tipos de entidad extra <span className="text-white/30">(uno por línea: TIPO: descripción)</span>
                  </label>
                  <textarea
                    value={customEntityTypes}
                    onChange={(e) => setCustomEntityTypes(e.target.value)}
                    disabled={processing}
                    placeholder={"RITUAL: Ritual o ceremonia religiosa\nPRIEST: Sacerdote o líder religioso"}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-white/5 text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green disabled:opacity-50 resize-none font-mono"
                  />
                </div>

                {/* Tipos de relación personalizados */}
                <div>
                  <label className="text-[10px] text-cetiem-gray mb-1 block">
                    Tipos de relación extra <span className="text-white/30">(uno por línea: TIPO: descripción)</span>
                  </label>
                  <textarea
                    value={customRelationTypes}
                    onChange={(e) => setCustomRelationTypes(e.target.value)}
                    disabled={processing}
                    placeholder={"PURIFIES: Purifica a persona\nDIAGNOSES: Diagnóstica condición"}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-white/5 text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green disabled:opacity-50 resize-none font-mono"
                  />
                </div>

                {/* Instrucciones adicionales */}
                <div>
                  <label className="text-[10px] text-cetiem-gray mb-1 block">
                    Instrucciones adicionales <span className="text-white/30">(texto libre)</span>
                  </label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    disabled={processing}
                    placeholder="ej: presta especial atención a los procedimientos descritos en cada versículo"
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-white/5 text-white placeholder-white/20 focus:outline-none focus:border-cetiem-green disabled:opacity-50 resize-none"
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
              ? "bg-cetiem-amber hover:bg-cetiem-amber/90 text-white"
              : "border border-white/10 hover:border-cetiem-green/40 text-white",
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
