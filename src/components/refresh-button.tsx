"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={() => window.location.reload()}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      Recargar
    </Button>
  );
}
