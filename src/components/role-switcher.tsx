"use client";

import { useRole, type UserRole } from "@/lib/role-context";
import { Building2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Nota: este componente muestra el rol actual solo como referencia.
// El rol se deriva de la sesión del servidor y no puede cambiarse desde el cliente.
const ROLES: { id: UserRole; label: string; desc: string; icon: typeof Building2; color: string }[] = [
  { id: "company", label: "Empresa", desc: "Cliente certificante", icon: Building2, color: "text-economia-info" },
  { id: "assessor", label: "Data Assessor", desc: "Auditor Institucional", icon: ClipboardCheck, color: "text-economia-warning" },
  { id: "admin", label: "Super Admin", desc: "Administración global", icon: ShieldCheck, color: "text-economia-success" },
];

export function RoleSwitcher() {
  const { role } = useRole();
  const current = ROLES.find((r) => r.id === role) ?? ROLES[0];
  const Icon = current.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted border-border text-sm")}>
      <Icon className={cn("h-4 w-4 shrink-0", current.color)} />
      <div className="flex-1 text-left min-w-0">
        <p className="text-foreground text-xs font-medium truncate">{current.label}</p>
        <p className="text-muted-foreground/60 text-[10px] truncate">{current.desc}</p>
      </div>
    </div>
  );
}
