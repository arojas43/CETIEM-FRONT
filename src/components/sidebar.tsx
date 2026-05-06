'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useRole } from '@/lib/role-context'
import { useEffect, useState, useRef } from 'react'
import {
  LayoutDashboard, FileText, Upload, Award, Building2,
  ClipboardList, Users, BarChart3, ScrollText, Settings,
  MessageSquare, Network, ShieldAlert, Bell, X, CheckCheck, LogOut as SignOutIcon,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstitutionalLogo } from './institutional-logo'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  disabled?: boolean
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  company: [
    { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { href: '/dashboard/documents', label: 'Documentos ESG', icon: FileText },
    { href: '/dashboard/upload', label: 'Carga Masiva', icon: Upload },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert },
    { href: '/dashboard/mi-certificado', label: 'Certificación', icon: Award },
  ],
  assessor: [
    { href: '/dashboard', label: 'Panel de Control', icon: LayoutDashboard },
    { href: '/dashboard/queue', label: 'Cola de Revisión', icon: ClipboardList, badge: 'NUEVO' },
    { href: '/dashboard/companies', label: 'Empresas ESG', icon: Building2 },
    { href: '/dashboard/documents', label: 'Documentos', icon: FileText },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert },
    { href: '/dashboard/graph', label: 'Grafo Global', icon: Network },
  ],
  admin: [
    { href: '/dashboard', label: 'Supervisión', icon: LayoutDashboard },
    { href: '/dashboard/companies', label: 'Empresas', icon: Building2 },
    { href: '/dashboard/assessors', label: 'Assessors ESG', icon: Users },
    { href: '/dashboard/documents', label: 'Fondo Documental', icon: FileText },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert },
    { href: '/dashboard/graph', label: 'Grafo de Relaciones', icon: Network },
    { href: '/dashboard/logs', label: 'Auditoría', icon: ScrollText },
    { href: '/dashboard/analytics', label: 'Métricas Reales', icon: BarChart3, disabled: true },
    { href: '/dashboard/settings', label: 'Configuración', icon: Settings, disabled: true },
  ],
}

const ROLE_META: Record<string, { label: string; color: string; hint: string }> = {
  company: { label: 'Portal Empresa', color: 'text-[#9D2449]', hint: 'Procesamiento de documentos asistido por IA NVIDIA NIM.' },
  assessor: { label: 'Data Assessor', color: 'text-[#BC955C]', hint: 'Validación técnica y emisión de dictámenes V.L.A.P.' },
  admin: { label: 'Administrador', color: 'text-[#12322B]', hint: 'Gestión global y monitoreo del ecosistema institucional.' },
}

interface Notif {
  id: string; type: string; title: string; body: string;
  read: boolean; link: string | null; createdAt: string;
}

function NotificationBell() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const { notifications, unreadCount } = await res.json();
      setNotifs(notifications);
      setUnread(unreadCount);
    } catch { }
  };

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    setMarking(true);
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      await load();
    } catch { } finally {
      setMarking(false);
    }
  };

  const NOTIF_ICON: Record<string, string> = {
    CERT_APPROVED: "🏆", CERT_REJECTED: "❌", CERT_CAPA_OPEN: "⚠️",
    CERT_IN_REVIEW: "🔍", CERT_REVOKED: "🚫", CAPA_CREATED: "🎫", CAPA_RESOLVED: "✅",
    ASSESSOR_ASSIGNED: "👤", DOC_ANALYZED: "🤖",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(p => !p); if (!open && unread > 0) load(); }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:ring-2 focus:ring-[#9D2449]/20"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 bg-[#9D2449] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-gray-200 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-bold text-[#545454]">Notificaciones</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAll} disabled={marking}
                  className="text-[10px] text-[#9D2449] hover:underline flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Marcar leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-10" />
                Sin notificaciones pendientes
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => { setOpen(false); if (n.link) router.push(n.link); }}
                  className={cn(
                    "px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors",
                    !n.read && "bg-[#9D2449]/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0 mt-0.5">{NOTIF_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold leading-tight", n.read ? "text-[#545454]" : "text-[#1B1B1B]")}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-[#545454]/80 mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[9px] text-gray-400 mt-1.5 font-medium">
                        {new Date(n.createdAt).toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })} • {new Date(n.createdAt).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-[#9D2449] shrink-0 mt-1" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  userName,
  userEmail,
  onClose,
}: {
  userName?: string | null;
  userEmail?: string | null;
  onClose?: () => void;
}) {
  const pathname = usePathname()
  const { role } = useRole()
  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.company
  const meta = ROLE_META[role]

  return (
    <aside className="w-72 bg-white flex flex-col h-screen border-r border-border shadow-gob shrink-0">
      {/* Pleca Institucional Superior */}
      <div className="bg-[#12322B] w-full h-12 flex items-center px-5 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-[#A57F2C]/20 to-transparent" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Shield className="h-4 w-4 text-[#A57F2C] shrink-0" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest truncate">ECONOMIA IA+</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-white/60 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-6 py-6 border-b border-gray-100 bg-[#FFFFFF]">
        <InstitutionalLogo size="sm" />
        <div className={cn('mt-4 inline-flex items-center px-3 py-1 border border-current text-[11px] font-bold uppercase tracking-[0.2em] bg-opacity-10', meta.color, meta.color.replace('text-', 'bg-'))}>
          {meta.label}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const exactMatch = item.href === '/dashboard'
          const isActive = exactMatch
            ? pathname === item.href
            : pathname.startsWith(item.href)

          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 cursor-not-allowed select-none italic font-medium"
              >
                <Icon className="h-5 w-5 shrink-0 opacity-30" />
                {item.label}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-all group relative',
                isActive
                  ? 'bg-gray-50 text-[#9D2449] font-bold border-r-4 border-[#9D2449]'
                  : 'text-[#545454] hover:bg-gray-50 hover:text-[#9D2449]'
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-[#9D2449]" : "text-gray-400 group-hover:text-[#9D2449]")} />
              <span className="text-sm font-semibold uppercase tracking-wide">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] font-black bg-[#BC955C] text-white px-2 py-0.5 rounded-sm tracking-tighter">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* AI Assistance Badge */}
      <div className="px-3 pb-3">
        <div className="bg-gray-50 border border-gray-100 p-5 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-[#9D2449]" />
            <span className="text-[11px] font-black text-[#1B1B1B] uppercase tracking-[0.2em]">Asistente IA</span>
          </div>
          <p className="text-xs text-[#545454] leading-relaxed italic font-medium opacity-80">
            "{meta.hint}"
          </p>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1.5 p-4 border-t border-border bg-gray-50/50">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm border border-[#611232]/20">
            <span className="text-white text-sm font-black">
              {(userName || userEmail || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 truncate uppercase mt-0.5">{userName?.split(' ')[0] || userEmail?.split('@')[0]}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-economia-success animate-pulse" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Activo</span>
            </div>
          </div>
          <NotificationBell />
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-black text-[#611232] hover:bg-[#611232]/5 rounded-xl transition-all border border-[#611232]/10 uppercase tracking-widest mt-2 group"
        >
          <SignOutIcon className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
