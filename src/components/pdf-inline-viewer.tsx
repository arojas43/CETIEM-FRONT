"use client";

import { useState } from "react";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfInlineViewerProps {
  url: string;
  /** Height of the embedded viewer. Default "70vh" */
  height?: string;
  className?: string;
}

export function PdfInlineViewer({ url, height = "70vh", className }: PdfInlineViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(p => !p)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors border",
            open
              ? "bg-cetiem-green/10 border-cetiem-green/30 text-cetiem-green hover:bg-cetiem-green/20"
              : "bg-cetiem-card border-white/10 text-cetiem-gray hover:border-cetiem-green/40 hover:text-cetiem-green"
          )}
        >
          {open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {open ? "Ocultar PDF" : "Ver PDF"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir en nueva pestaña"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors border bg-cetiem-card border-white/10 text-cetiem-gray/50 hover:text-cetiem-gray hover:border-white/20"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {open && (
        <iframe
          src={url}
          title="PDF Viewer"
          style={{ height }}
          className="w-full mt-3 rounded-xl border border-white/10 bg-white"
        />
      )}
    </div>
  );
}
