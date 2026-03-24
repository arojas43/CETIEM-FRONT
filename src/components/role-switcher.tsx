"use client";

import { useRole, type UserRole } from "@/lib/role-context";
import { Building2, ClipboardCheck, ShieldCheck, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ROLES: { id: UserRole; label: string; desc: string; icon: typeof Building2; color: string }[] = [
  { id: "company",  label: "Empresa",       desc: "Cliente certificante",  icon: Building2,     color: "text-cetiem-teal" },
  { id: "assessor", label: "Data Assessor", desc: "Auditor CETIEM",        icon: ClipboardCheck, color: "text-cetiem-amber" },
  { id: "admin",    label: "Super Admin",   desc: "Administración global", icon: ShieldCheck,    color: "text-cetiem-lime" },
];

export function RoleSwitcher() {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);

  const current = ROLES.find((r) => r.id === role)!;
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm",
          "bg-white/5 border-white/10 hover:border-white/20"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", current.color)} />
        <div className="flex-1 text-left min-w-0">
          <p className="text-white text-xs font-medium truncate">{current.label}</p>
          <p className="text-cetiem-gray/60 text-[10px] truncate">{current.desc}</p>
        </div>
        <ChevronUp className={cn("h-3 w-3 text-cetiem-gray transition-transform shrink-0", !open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-cetiem-card border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] font-medium text-cetiem-gray/50 uppercase tracking-widest">
              Modo de prueba — Vista como
            </p>
          </div>
          {ROLES.map((r) => {
            const RIcon = r.icon;
            return (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/5",
                  role === r.id && "bg-white/5"
                )}
              >
                <RIcon className={cn("h-4 w-4 shrink-0", r.color)} />
                <div className="flex-1">
                  <p className="text-white text-xs font-medium">{r.label}</p>
                  <p className="text-cetiem-gray/50 text-[10px]">{r.desc}</p>
                </div>
                {role === r.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-cetiem-green shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
