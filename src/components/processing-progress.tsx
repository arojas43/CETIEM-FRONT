"use client";

import { useEffect, useRef, useState } from "react";
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

export function ProcessingProgress({ documentId, status: initialStatus, className }: ProcessingProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(
    initialStatus === "PROCESSING" || initialStatus === "PENDING"
  );
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const isActive = status === "PROCESSING" || status === "PENDING";
    if (!isActive) {
      setLoading(false);
      return;
    }

    // Try SSE first; fall back to polling if EventSource fails or Redux unavailable
    const es = new EventSource(`/api/documents/${documentId}/progress`);
    esRef.current = es;
    let usedSSE = false;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.progress) setProgress(data.progress);
        if (data.status) setStatus(data.status);
        setLoading(false);
        usedSSE = true;
      } catch { }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (!usedSSE) {
        // SSE unavailable (no Redis); fall back to polling
        startPolling();
      }
    };

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      const poll = async () => {
        try {
          const res = await fetch(`/api/documents/${documentId}/progress`);
          if (res.ok) {
            const data = await res.json();
            if (data.progress) setProgress(data.progress);
            if (data.status) setStatus(data.status);
          }
        } catch { }
        setLoading(false);
      };
      poll();
      pollInterval = setInterval(poll, 2000);
    }

    return () => {
      es.close();
      esRef.current = null;
      if (pollInterval) clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, status]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-economia-info" />
        <span>Cargando progreso...</span>
      </div>
    );
  }

  if (status === "ANALYZED" || status === "INDEXED") {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-[#00D47A] transition-all duration-500" style={{ width: "100%" }} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#00D47A]">
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
    if (details?.stage?.includes("error")) return "bg-economia-error";
    if (details?.stage?.includes("openkb") || details?.stage?.includes("analysis")) return "bg-economia-success";
    if (details?.stage?.includes("index") || details?.stage?.includes("pageindex")) return "bg-economia-info";
    return "bg-[#00D47A]";
  };

  const statusIcon = () => {
    if (status === "FAILED") return <AlertCircle className="h-3.5 w-3.5 text-economia-error" />;
    if (status === "ANALYZED") return <CheckCircle className="h-3.5 w-3.5 text-[#00D47A]" />;
    return <Clock className="h-3.5 w-3.5 text-economia-info" />;
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 ease-out", getBarColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {statusIcon()}
          <span>{step}</span>
        </div>
        <span className="text-muted-foreground/60">{percentage.toFixed(0)}%</span>
      </div>

      {details && (
        <div className="text-xs text-muted-foreground/60 space-y-0.5">
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
