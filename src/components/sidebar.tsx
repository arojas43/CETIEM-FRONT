'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useRole } from '@/lib/role-context'
import { useEffect, useState, useRef } from 'react'
import {
  LayoutDashboard, FileText, Upload, Award, Building2,
  ClipboardList, Users, BarChart3, ScrollText, Settings,
  ShieldAlert, Bell, X, CheckCheck, LogOut as SignOutIcon,
  Sparkles,
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
  ],
  admin: [
    { href: '/dashboard', label: 'Supervisión', icon: LayoutDashboard },
    { href: '/dashboard/companies', label: 'Empresas', icon: Building2 },
    { href: '/dashboard/assessors', label: 'Assessors ESG', icon: Users },
    { href: '/dashboard/documents', label: 'Fondo Documental', icon: FileText },
    { href: '/dashboard/capa', label: 'Tickets CAPA', icon: ShieldAlert },
    { href: '/dashboard/logs', label: 'Auditoría', icon: ScrollText },
    { href: '/dashboard/analytics', label: 'Métricas Reales', icon: BarChart3, disabled: true },
    { href: '/dashboard/settings', label: 'Configuración', icon: Settings, disabled: true },
  ],
}

const ROLE_META: Record<string, { label: string; color: string; hint: string }> = {
  company: { label: 'Portal Empresa', color: 'text-[#00D47A]', hint: 'Procesamiento de documentos asistido por IA · Filtro Cero V.L.A.P.' },
  assessor: { label: 'Data Assessor', color: 'text-[#00C8E0]', hint: 'Validación técnica y emisión de dictámenes V.L.A.P.' },
  admin: { label: 'Administrador', color: 'text-[#ADFF4F]', hint: 'Gestión global y monitoreo del ecosistema CETIEM.' },
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

  // Carga inicial + polling solo si hay notificaciones no leídas (cada 60s)
  useEffect(() => {
    load();
    const id = setInterval(() => { if (unread > 0) load(); }, 60_000);
    return () => clearInterval(id);
  }, [unread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    setMarking(true);
    try { await fetch("/api/notifications", { method: "PATCH" }); await load(); }
    catch { } finally { setMarking(false); }
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
        className="relative p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-[#111111]/5 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-3 w-3 bg-[#00D47A] text-black text-[8px] font-black rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl overflow-hidden border border-white/10 shadow-glass z-50"
          style={{ background: '#111111' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Notificaciones</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAll} disabled={marking}
                  className="text-[10px] text-[#00D47A] hover:underline flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Marcar leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-white/20 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                Sin notificaciones pendientes
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => { setOpen(false); if (n.link) router.push(n.link); }}
                  className={cn(
                    "px-4 py-3 border-b border-white/5 last:border-0 cursor-pointer hover:bg-[#111111]/4 transition-colors",
                    !n.read && "bg-[#00D47A]/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">{NOTIF_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold leading-tight", n.read ? "text-white/50" : "text-white")}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-white/40 mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[9px] text-white/25 mt-1.5 font-medium">
                        {new Date(n.createdAt).toLocaleDateString("es-MX", { day: 'numeric', month: 'short' })} · {new Date(n.createdAt).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-[#00D47A] shrink-0 mt-1" />}
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
    <aside className="w-64 flex flex-col h-screen shrink-0"
      style={{ background: '#0D0D0D', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo header */}
      <div className="px-5 py-5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <InstitutionalLogo size="sm" />
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 text-white/30 hover:text-white/60 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Role badge */}
        <div className="mt-4">
          <span className={cn("badge-green text-[9px]", meta.color === 'text-[#00C8E0]' && "badge-cyan", meta.color === 'text-[#ADFF4F]' && "badge-lime")}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const exactMatch = item.href === '/dashboard'
          const isActive = exactMatch ? pathname === item.href : pathname.startsWith(item.href)

          if (item.disabled) {
            return (
              <div key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 text-xs text-white/20 cursor-not-allowed select-none rounded-lg">
                <Icon className="h-4 w-4 shrink-0 opacity-20" />
                {item.label}
              </div>
            )
          }

          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group text-sm font-medium',
                isActive
                  ? 'bg-[#00D47A]/10 text-[#00D47A] border-l-2 border-[#00D47A]'
                  : 'text-white/45 hover:text-white/80 hover:bg-[#111111]/5 border-l-2 border-transparent'
              )}
            >
              <Icon className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-[#00D47A]" : "text-white/30 group-hover:text-white/60"
              )} />
              <span className="tracking-wide leading-none">{item.label}</span>
              {item.badge && (
                <span className="ml-auto badge-green text-[8px]">{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* AI hint */}
      <div className="px-3 pb-3">
        <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,122,0.04)', border: '1px solid rgba(0,212,122,0.12)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-[#00D47A]" />
            <span className="text-[9px] font-black text-[#00D47A] uppercase tracking-widest">Filtro Cero IA</span>
          </div>
          <p className="text-[10px] text-white/35 leading-relaxed">{meta.hint}</p>
        </div>
      </div>

      {/* User + actions */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,212,122,0.15)', border: '1px solid rgba(0,212,122,0.3)' }}>
            <span className="text-[#00D47A] text-xs font-black">
              {(userName || userEmail || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white/80 truncate leading-none">
              {userName?.split(' ')[0] || userEmail?.split('@')[0]}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D47A]" style={{ boxShadow: '0 0 6px #00D47A' }} />
              <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest">En línea</span>
            </div>
          </div>
          <NotificationBell />
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold text-white/30 hover:text-white/60 rounded-lg hover:bg-[#111111]/5 transition-all uppercase tracking-widest group"
        >
          <SignOutIcon className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
