"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { PdfModal } from "@/components/pdf-modal";

export function CompanyCertificateButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-economia-success hover:bg-economia-success/90 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
      >
        <Download className="h-4 w-4" /> Ver Certificado
      </button>
      {open && (
        <PdfModal
          url={`/api/companies/${companyId}/certificate`}
          title="Certificado ESG"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
