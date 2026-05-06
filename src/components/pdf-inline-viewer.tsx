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
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<IframeState>("idle");

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
              ? "opacity-40 cursor-not-allowed border-border text-muted-foreground"
              : open
                ? "bg-economia-guinda/10 border-economia-guinda/30 text-economia-guinda hover:bg-economia-guinda/20"
                : "bg-card border-border text-muted-foreground hover:border-economia-guinda/40 hover:text-economia-guinda"
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors border bg-card border-border text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-xl border border-border overflow-hidden bg-white" style={{ height }}>
          {state === "error" ? (
            /* ── Error fallback ─────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center h-full gap-3 bg-economia-verdeDark p-6">
              <AlertCircle className="h-10 w-10 text-economia-error/50" />
              <p className="text-muted-foreground text-sm text-center">
                No se pudo mostrar el PDF en el navegador.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs bg-economia-guinda hover:bg-economia-guinda/90 text-primary-foreground font-medium px-4 py-2 rounded-xl transition-colors"
              >
                <FileText className="h-4 w-4" />
                Abrir PDF en nueva pestaña
              </a>
            </div>
          ) : (
            /* ── iframe ─────────────────────────────────────────────── */
            <>
              {state === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-economia-verdeDark/80 z-10">
                  <Loader2 className="h-8 w-8 text-economia-guinda animate-spin" />
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
