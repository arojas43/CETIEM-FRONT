"use client";

import { useState } from "react";
import { RefreshCw, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessDocumentButtonProps {
  documentId: string;
  currentDomain: string;
  currentStatus: string;
}

export default function ProcessDocumentButton({
  documentId,
  currentDomain,
  currentStatus,
}: ProcessDocumentButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [domain, setDomain] = useState(currentDomain || "LEGAL");

  const handleProcess = async () => {
    if (!confirm(`¿Procesar documento con dominio ${domain}? Esto puede tomar varios minutos.`)) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
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
        <div>
          <label className="text-xs text-cetiem-gray mb-1 block">Dominio de análisis:</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={processing}
            className="w-full h-8 px-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white focus:outline-none focus:border-cetiem-green disabled:opacity-50"
          >
            <option value="LEGAL">📜 Legal</option>
            <option value="MEDICAL">🏥 Médico</option>
            <option value="TECHNICAL">⚙️ Técnico</option>
            <option value="ACADEMIC">🎓 Académico</option>
            <option value="CUSTOM">📝 Custom</option>
          </select>
        </div>

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
