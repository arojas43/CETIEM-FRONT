"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, RefreshCw } from "lucide-react";

export function KillSwitchButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const handleRevoke = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/certifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
        setConfirming(false);
      }
    } catch {
      alert("Error de conexión al revocar el certificado.");
    } finally {
      setLoading(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-economia-error/5 border border-economia-error/20 rounded-xl">
        <p className="text-[10px] text-economia-error font-bold uppercase">Revocar Certificado</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Razón de la revocación..."
          className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg text-foreground placeholder-white/20 focus:outline-none focus:border-economia-error resize-none"
          rows={2}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={handleRevoke}
            disabled={loading || !reason.trim()}
            className="flex-1 py-1.5 bg-economia-error text-primary-foreground text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Confirmar Revocación"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 px-4 py-2 bg-economia-error/10 border border-economia-error/30 hover:border-economia-error/60 text-economia-error rounded-xl text-sm transition-colors"
      title="CERT_REVOKED — Kill Switch"
    >
      <ShieldOff className="h-4 w-4" />
      Revocar
    </button>
  );
}
