"use client";

import { useState } from "react";
import { RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    if (!confirm(`¿Procesar documento con dominio ${domain}? Esto puede tomar varios minutos.`)) {
      return;
    }

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
        // Recargar página después de procesar
        window.location.reload();
      } else {
        alert(`❌ Error al procesar: ${result.error || result.message}`);
      }
    } catch (error: any) {
      console.error("Error processing document:", error);
      alert(`Error al procesar documento: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const isPendingOrFailed = currentStatus === "PENDING" || currentStatus === "FAILED";

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-orange-200 bg-orange-50">
      <CardHeader>
        <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
          <Brain className="h-6 w-6 text-orange-600" />
        </div>
        <CardTitle>Procesar Documento</CardTitle>
        <CardDescription>
          Ejecuta PageIndex + Cognee manualmente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Selector de dominio */}
        <div>
          <label className="text-xs text-gray-600 mb-1 block">Dominio de análisis:</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={processing}
            className="w-full h-9 px-2 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          >
            <option value="LEGAL">📜 Legal (Normas, ISO)</option>
            <option value="MEDICAL">🏥 Médico (Enfermedades, tratamientos)</option>
            <option value="TECHNICAL">⚙️ Técnico (Manuales, especificaciones)</option>
            <option value="ACADEMIC">🎓 Académico (Papers, tesis)</option>
            <option value="CUSTOM">📝 Custom (Genérico)</option>
          </select>
        </div>

        {/* Botón de procesar */}
        <Button
          onClick={handleProcess}
          disabled={processing}
          variant={isPendingOrFailed ? "default" : "outline"}
          className={cn(
            "w-full",
            isPendingOrFailed ? "bg-orange-600 hover:bg-orange-700" : "",
            processing && "animate-pulse"
          )}
        >
          {processing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              {isPendingOrFailed ? "Procesar" : "Reprocesar"}
            </>
          )}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          {isPendingOrFailed
            ? "El documento no ha sido procesado correctamente"
            : "Vuelve a procesar con otro dominio"}
        </p>
      </CardContent>
    </Card>
  );
}
