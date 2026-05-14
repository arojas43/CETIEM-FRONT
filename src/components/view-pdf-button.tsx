"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfModal } from "@/components/pdf-modal";

export function ViewPdfButton({ storageUrl, name }: { storageUrl: string; name?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        Ver PDF Original
      </Button>
      {open && <PdfModal url={storageUrl} title={name ?? "PDF"} onClose={() => setOpen(false)} />}
    </>
  );
}
