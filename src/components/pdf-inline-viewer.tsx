"use client";

import { useState } from "react";
import { Eye, EyeOff, ExternalLink, FileText, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfInlineViewerProps {
  url: string;
  /** Height of the embedded viewer. Default "70vh" */
  height?: string;
  className?: string;
}

type IframeState = "idle" | "loading" | "ready" | "error";

export function PdfInlineViewer({ url, height = "70vh", className }: PdfInlineViewerProps) {
  const [open, setOpen]             = useState(false);
  const [state, setState]           = useState<IframeState>("idle");

  const handleToggle = () => {
    if (!open) setState("loading");
    setOpen(p => !p);
  };

  // URL is missing or points to /pending
  const unavailable = !url || url === "/pending";

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          disabled={unavailable}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors border",
            unavailable
              ? "opacity-40 cursor-not-allowed border-white/5 text-cetiem-gray"
              : open
                ? "bg-cetiem-green/10 border-cetiem-green/30 text-cetiem-green hover:bg-cetiem-green/20"
                : "bg-cetiem-card border-white/10 text-cetiem-gray hover:border-cetiem-green/40 hover:text-cetiem-green"
          )}
          title={unavailable ? "PDF no disponible" : open ? "Ocultar PDF" : "Ver PDF inline"}
        >
          {state === "loading" && open
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : open
              ? <EyeOff className="h-4 w-4" />
              : <Eye className="h-4 w-4" />
          }
          {open ? "Ocultar PDF" : "Ver PDF"}
        </button>

        {!unavailable && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en nueva pestaña"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors border bg-cetiem-card border-white/10 text-cetiem-gray/50 hover:text-cetiem-gray hover:border-white/20"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-white/10 overflow-hidden bg-white" style={{ height }}>
          {state === "error" ? (
            /* ── Error fallback ─────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full gap-3 bg-cetiem-dark p-6">
              <AlertCircle className="h-10 w-10 text-cetiem-red/50" />
              <p className="text-cetiem-gray text-sm text-center">
                No se pudo mostrar el PDF en el navegador.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs bg-cetiem-green hover:bg-cetiem-green/90 text-white font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <FileText className="h-4 w-4" />
                Abrir PDF en nueva pestaña
              </a>
            </div>
          ) : (
            /* ── iframe ─────────────────────────────────────────────── */
            <>
              {state === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-cetiem-dark/80 z-10">
                  <Loader2 className="h-8 w-8 text-cetiem-green animate-spin" />
                </div>
              )}
              <iframe
                src={url}
                title="PDF Viewer"
                className="w-full h-full border-0"
                onLoad={() => setState("ready")}
                onError={() => setState("error")}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
