"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { PdfModal } from "@/components/pdf-modal";

export function CertificateButton({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-economia-success/10 border border-economia-success/30 hover:border-economia-success/60 text-economia-success rounded-xl text-sm transition-colors"
      >
        <Award className="h-4 w-4" />
        Certificado ESG
      </button>
      {open && (
        <PdfModal
          url={`/api/documents/${documentId}/certificate`}
          title="Certificado ESG"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
