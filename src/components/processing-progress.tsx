"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingProgressProps {
  documentId: string;
  status: string;
  className?: string;
}

interface ProgressData {
  percentage: number;
  step: string;
  details?: {
    stage?: string;
    totalIndices?: number;
    totalChunks?: number;
    processedChunks?: number;
    [key: string]: any;
  };
}

export function ProcessingProgress({ documentId, status, className }: ProcessingProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const isActive = status === "PROCESSING" || status === "PENDING";
  const [loading, setLoading] = useState(isActive);

  useEffect(() => {
    // Solo hacer polling si está procesando activamente
    if (!isActive) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/progress`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data.progress);
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Polling cada 2 segundos
    const interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [documentId, status]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Cargando progreso...</span>
      </div>
    );
  }

  if (status === "ANALYZED" || status === "INDEXED") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-green-500 transition-all duration-500" style={{ width: "100%" }} />
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">
            {status === "ANALYZED" ? "Análisis completado" : "Indexación completada"}
          </span>
        </div>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const { percentage, step, details } = progress;

  // Determinar color basado en el stage
  const getStageColor = () => {
    if (details?.stage?.includes("error")) return "bg-red-500";
    if (details?.stage?.includes("cognee") || details?.stage?.includes("analysis")) return "bg-purple-500";
    if (details?.stage?.includes("index") || details?.stage?.includes("pageindex")) return "bg-blue-500";
    return "bg-indigo-500";
  };

  // Determinar ícono basado en el estado
  const getIcon = () => {
    if (status === "FAILED") return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (status === "ANALYZED") return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <Clock className="h-4 w-4 text-indigo-600" />;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Barra de progreso */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out",
            getStageColor()
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Información detallada */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-medium">{step}</span>
        </div>
        <span className="text-gray-500">{percentage.toFixed(0)}%</span>
      </div>

      {/* Detalles adicionales */}
      {details && (
        <div className="text-xs text-gray-500 space-y-1">
          {details.totalIndices && (
            <div>
              📑 {details.totalIndices} índices creados
            </div>
          )}
          {details.totalChunks && details.processedChunks && (
            <div>
              🧩 {details.processedChunks}/{details.totalChunks} chunks procesados
            </div>
          )}
          {details.fileSize && (
            <div>
              📄 {(details.fileSize / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
          {details.duration && (
            <div>
              ⏱️  {details.duration}s
            </div>
          )}
        </div>
      )}
    </div>
  );
}
