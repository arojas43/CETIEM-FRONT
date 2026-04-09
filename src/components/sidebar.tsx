'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useRole } from '@/lib/role-context'
import { useEffect, useState, useRef } from 'react'
import {
  LayoutDashboard, FileText, Upload, Award, Building2,
  ClipboardList, Users, BarChart3, ScrollText, Settings,
  LogOut, MessageSquare, Network, ShieldAlert, Bell, X, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  disabled?: boolean
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  company: [
    { href: '/dashboard',             label: 'Dashboard',        icon: LayoutDashboard },
    { href: '/dashboard/documents',   label: 'Mis Documentos',   icon: FileText },
    { href: '/dashboard/upload',          label: 'Subir Documentos', icon: Upload },
    { href: '/dashboard/capa',            label: 'Tickets CAPA',     icon: ShieldAlert },
    { href: '/dashboard/mi-certificado',  label: 'Mi Certificado',   icon: Award },
  ],
  assessor: [
    { href: '/dashboard',             label: 'Dashboard',          icon: LayoutDashboard },
    { href: '/dashboard/queue',       label: 'Cola de Revisión',   icon: ClipboardList, badge: 'NEW' },
    { href: '/dashboard/companies',   label: 'Empresas Asignadas', icon: Building2 },
    { href: '/dashboard/documents',   label: 'Documentos',         icon: FileText },
    { href: '/dashboard/capa',        label: 'Tickets CAPA',       icon: ShieldAlert },
    { href: '/dashboard/graph',       label: 'Grafo Global',       icon: Network },
  ],
  admin: [
    { href: '/dashboard',             label: 'Dashboard',          icon: LayoutDashboard },
    { href: '/dashboard/companies',   label: 'Empresas',           icon: Building2 },
    { href: '/dashboard/assessors',   label: 'Assessors',          icon: Users },
    { href: '/dashboard/documents',   label: 'Documentos',         icon: FileText },
    { href: '/dashboard/capa',        label: 'Tickets CAPA',       icon: ShieldAlert },
    { href: '/dashboard/graph',       label: 'Grafo Global',       icon: Network },
    { href: '/dashboard/logs',        label: 'Logs de Auditoría',  icon: ScrollText },
    { href: '/dashboard/analytics',   label: 'Métricas',           icon: BarChart3, disabled: true },
    { href: '/dashboard/settings',    label: 'Configuración',      icon: Settings, disabled: true },
  ],
}

const ROLE_META: Record<string, { label: string; color: string; hint: string }> = {
  company:  { label: 'Portal Empresa',  color: 'text-cetiem-teal',  hint: 'Tus documentos son analizados con IA de alto nivel impulsada por NVIDIA.' },
  assessor: { label: 'Panel Assessor',  color: 'text-cetiem-amber', hint: 'Plataforma de dictamen potenciada con IA de alto nivel impulsada por NVIDIA.' },
  admin:    { label: 'Super Admin',     color: 'text-cetiem-lime',  hint: 'Gestión global de la plataforma y stack tecnológico NVIDIA.' },
}

interface Notif {
  id: string; type: string; title: string; body: string;
  read: boolean; link: string | null; createdAt: string;
}

function NotificationBell() {
  const [notifs, setNotifs]   = useState<Notif[]>([]);
  const [unread, setUnread]   = useState(0);
  const [open, setOpen]       = useState(false);
  const [marking, setMarking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const { notifications, unreadCount } = await res.json();
      setNotifs(notifications);
      setUnread(unreadCount);
    } catch {}
  };

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAll = async () => {
    setMarking(true);
    await fetch("/api/notifications", { method: "PATCH" });
    await load();
    setMarking(false);
  };

  const NOTIF_ICON: Record<string, string> = {
    CERT_APPROVED: "🏆", CERT_REJECTED: "❌", CERT_CAPA_OPEN: "⚠️",
    CERT_IN_REVIEW: "🔍", CAPA_CREATED: "🎫", CAPA_RESOLVED: "✅",
    ASSESSOR_ASSIGNED: "👤", DOC_ANALYZED: "🤖",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(p => !p); if (!open && unread > 0) load(); }}
        className="relative p-2 rounded-lg text-cetiem-gray hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-cetiem-red text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-cetiem-card border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAll} disabled={marking}
                  className="text-[10px] text-cetiem-gray/60 hover:text-white flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Marcar leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-cetiem-gray/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-8 text-center text-cetiem-gray/40 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Sin notificaciones
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (n.link) { window.location.href = n.link; } setOpen(false); }}
                  className={cn(
                    "px-4 py-3 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 transition-colors",
                    !n.read && "bg-cetiem-green/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{NOTIF_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate", n.read ? "text-cetiem-gray" : "text-white")}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-cetiem-gray/60 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                      <p className="text-[9px] text-cetiem-gray/30 mt-1">
                        {new Date(n.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-cetiem-green shrink-0 mt-1" />}
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

export function Sidebar({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  const pathname  = usePathname()
  const { role }  = useRole()
  const navItems  = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.company
  const meta      = ROLE_META[role]

  return (
    <aside className="w-60 bg-cetiem-card border-r border-white/5 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo + role label */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="font-heading font-bold text-sm text-white tracking-tight leading-tight">SECRETARIA DE ECONOMIA</span>
        </div>
        <span className={cn('text-[10px] font-semibold uppercase tracking-widest', meta.color)}>
          {meta.label}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
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
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cetiem-gray/25 cursor-not-allowed select-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-cetiem-green text-white font-medium'
                  : 'text-cetiem-gray hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] font-bold bg-cetiem-amber text-black px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* IA hint */}
      <div className="px-3 pb-3">
        <div className="bg-cetiem-green/10 border border-cetiem-green/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-3.5 w-3.5 text-cetiem-green" />
            <span className="text-xs font-medium text-white">IA Asistente</span>
          </div>
          <p className="text-[10px] text-cetiem-gray/70 leading-relaxed">{meta.hint}</p>
        </div>
      </div>

      {/* User info + notifications + logout */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3 space-y-2">
        {(userName || userEmail) && (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-white/3 border border-white/5 min-w-0">
              <p className="text-white text-xs font-medium truncate">{userName || userEmail}</p>
              <p className="text-cetiem-gray/50 text-[10px] truncate">{userEmail}</p>
            </div>
            <NotificationBell />
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cetiem-gray hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
