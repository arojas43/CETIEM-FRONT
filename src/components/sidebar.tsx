'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Building2,
  CheckSquare,
  Calendar,
  FolderOpen,
  TrendingUp,
  User,
  Settings,
  LogOut,
  HelpCircle,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',           label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Mis empresas',  icon: Building2 },
  { href: '#',                    label: 'Tareas',         icon: CheckSquare,  disabled: true },
  { href: '#',                    label: 'Calendario',     icon: Calendar,     disabled: true },
  { href: '/dashboard/upload',    label: 'Archivos',       icon: FolderOpen },
  { href: '/dashboard/graph',     label: 'Progreso',       icon: TrendingUp },
]

const bottomItems = [
  { label: 'Perfil',          icon: User },
  { label: 'Ajustes',         icon: Settings },
  { label: 'Ayuda y soporte', icon: HelpCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-cetiem-card border-r border-white/5 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-heading font-bold text-xl text-white tracking-tight">CETIEM</span>
          <span className="text-cetiem-gray text-xs font-medium">S.C.</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cetiem-gray/30 cursor-not-allowed select-none"
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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-cetiem-green text-white font-medium'
                  : 'text-cetiem-gray hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-3 py-4 border-t border-white/5 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cetiem-gray/40 cursor-not-allowed select-none"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </div>
          )
        })}
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
