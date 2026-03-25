"use client";

import { useState } from "react";
import { ShieldOff, RefreshCw } from "lucide-react";

export function KillSwitchButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  const handleRevoke = async () => {
    const reason = prompt("⚠️ CERT_REVOKED — Ingresa la razón de la revocación:");
    if (!reason) return;
    if (!confirm(`¿Confirmas revocar este certificado?\n\nRazón: ${reason}\n\nEsta acción no se puede deshacer.`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/certifications`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Error de conexión al revocar el certificado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleRevoke}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-cetiem-red/10 border border-cetiem-red/30 hover:border-cetiem-red/60 text-cetiem-red rounded-xl text-sm transition-colors disabled:opacity-50"
      title="CERT_REVOKED — Kill Switch"
    >
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
      Revocar
    </button>
  );
}
