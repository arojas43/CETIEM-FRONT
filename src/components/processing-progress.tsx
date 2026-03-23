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
    const interval = setInterval(fetchProgress, 2000);
    return () => clearInterval(interval);
  }, [documentId, status]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-cetiem-gray", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cetiem-teal" />
        <span>Cargando progreso...</span>
      </div>
    );
  }

  if (status === "ANALYZED" || status === "INDEXED") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-cetiem-green transition-all duration-500" style={{ width: "100%" }} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-cetiem-green">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="font-medium">
            {status === "ANALYZED" ? "Análisis completado" : "Indexación completada"}
          </span>
        </div>
      </div>
    );
  }

  if (!progress) return null;

  const { percentage, step, details } = progress;

  const getBarColor = () => {
    if (details?.stage?.includes("error")) return "bg-cetiem-red";
    if (details?.stage?.includes("cognee") || details?.stage?.includes("analysis")) return "bg-cetiem-lime";
    if (details?.stage?.includes("index") || details?.stage?.includes("pageindex")) return "bg-cetiem-teal";
    return "bg-cetiem-green";
  };

  const getIcon = () => {
    if (status === "FAILED") return <AlertCircle className="h-3.5 w-3.5 text-cetiem-red" />;
    if (status === "ANALYZED") return <CheckCircle className="h-3.5 w-3.5 text-cetiem-green" />;
    return <Clock className="h-3.5 w-3.5 text-cetiem-teal" />;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Progress bar */}
      <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 ease-out", getBarColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Step info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-cetiem-gray">
          {getIcon()}
          <span>{step}</span>
        </div>
        <span className="text-cetiem-gray/60">{percentage.toFixed(0)}%</span>
      </div>

      {/* Details */}
      {details && (
        <div className="text-xs text-cetiem-gray/60 space-y-0.5">
          {details.totalIndices && <div>📑 {details.totalIndices} índices creados</div>}
          {details.totalChunks && details.processedChunks && (
            <div>🧩 {details.processedChunks}/{details.totalChunks} chunks procesados</div>
          )}
          {details.fileSize && <div>📄 {(details.fileSize / 1024 / 1024).toFixed(2)} MB</div>}
          {details.duration && <div>⏱️ {details.duration}s</div>}
        </div>
      )}
    </div>
  );
}
