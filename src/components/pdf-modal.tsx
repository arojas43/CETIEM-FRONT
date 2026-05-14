"use client";

import { useEffect, useRef } from "react";
import { X, Printer } from "lucide-react";

interface PdfModalProps {
  url: string;
  title?: string;
  onClose: () => void;
}

export function PdfModal({ url, title = "Documento", onClose }: PdfModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{title}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => iframeRef.current?.contentWindow?.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-[#00D47A]/40 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={url}
        title={title}
        className="flex-1 w-full border-0 bg-[#111111]"
      />
    </div>
  );
}
