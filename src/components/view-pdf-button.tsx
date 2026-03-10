"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function ViewPdfButton({ documentId, documentName }: { documentId: string; documentName: string }) {
  return (
    <Button 
      variant="outline" 
      onClick={() => window.open(`/api/files/${documentId}/${encodeURIComponent(documentName)}`, '_blank')}
    >
      <FileText className="mr-2 h-4 w-4" />
      Ver PDF Original
    </Button>
  );
}
