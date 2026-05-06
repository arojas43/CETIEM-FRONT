"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { InstitutionalLogo } from "./institutional-logo";

export function DashboardShell({
  children,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A0A0A' }}>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 shrink-0",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <Sidebar userName={userName} userEmail={userEmail} onClose={() => setOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b shrink-0 sticky top-0 z-30"
          style={{ background: '#0D0D0D', borderColor: 'rgba(255,255,255,0.06)' }}>
          <button onClick={() => setOpen(true)}
            className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-[#111111]/5 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <InstitutionalLogo size="sm" />
        </div>

        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
