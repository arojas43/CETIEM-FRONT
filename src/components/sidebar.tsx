'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useRole } from '@/lib/role-context'
import {
  LayoutDashboard, FileText, Upload, Award, Building2,
  ClipboardList, Users, BarChart3, ScrollText, Settings,
  LogOut, HelpCircle, MessageSquare, Network, ShieldAlert, Download,
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
    { href: '/dashboard/upload',      label: 'Subir Documento',  icon: Upload },
    { href: '/dashboard/capa',        label: 'Tickets CAPA',     icon: ShieldAlert },
    { href: '/dashboard/certificate', label: 'Mi Certificación', icon: Award, disabled: true },
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
  company:  { label: 'Portal Empresa',  color: 'text-cetiem-teal',  hint: 'Consulta documentos con GLM4.7.' },
  assessor: { label: 'Panel Assessor',  color: 'text-cetiem-amber', hint: 'Revisa expedientes en la cola.' },
  admin:    { label: 'Super Admin',     color: 'text-cetiem-lime',  hint: 'Gestión global de la plataforma.' },
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
          <span className="font-heading font-bold text-xl text-white tracking-tight">CETIEM</span>
          <span className="text-cetiem-gray text-xs font-medium">S.C.</span>
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

      {/* User info + logout */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3 space-y-2">
        {(userName || userEmail) && (
          <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5">
            <p className="text-white text-xs font-medium truncate">{userName || userEmail}</p>
            <p className="text-cetiem-gray/50 text-[10px] truncate">{userEmail}</p>
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
