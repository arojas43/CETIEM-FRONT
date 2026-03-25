"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export function ViewPdfButton({ storageUrl }: { storageUrl: string }) {
  return (
    <Button
      variant="outline"
      onClick={() => window.open(storageUrl, '_blank')}
    >
      <FileText className="mr-2 h-4 w-4" />
      Ver PDF Original
    </Button>
  );
}
