'use client'

import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'

interface BrandThemeToggleProps {
  className?: string
  compact?: boolean
}

export function BrandThemeToggle({ className, compact = false }: BrandThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className={cn(
        'flex items-center rounded-full p-0.5 transition-colors duration-300',
        theme === 'cetiem'
          ? 'bg-white/[0.06] border border-white/10'
          : 'bg-black/[0.06] border border-black/10',
        className,
      )}
      role="group"
      aria-label="Cambiar tema visual"
    >
      {/* CETIEM tab */}
      <button
        onClick={() => setTheme('cetiem')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300',
          theme === 'cetiem'
            ? 'bg-[#00D47A] text-[#0A0A0A] shadow-[0_2px_8px_rgba(0,212,122,0.4)]'
            : 'text-white/40 hover:text-white/70',
        )}
      >
        {/* Hexagon icon */}
        <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden>
          <path d="M5 0.5L9.33 3v5L5 10.5.67 8V3L5 .5z" />
        </svg>
        {!compact && 'CETIEM'}
      </button>

      {/* SE Institucional tab */}
      <button
        onClick={() => setTheme('institucional')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300',
          theme === 'institucional'
            ? 'bg-[#9D2449] text-white shadow-[0_2px_8px_rgba(157,36,73,0.4)]'
            : theme === 'cetiem'
              ? 'text-white/40 hover:text-white/70'
              : 'text-black/40 hover:text-black/70',
        )}
      >
        {/* Shield / escudo icon */}
        <svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor" aria-hidden>
          <path d="M4.5.5 9 2.5v4c0 2-4.5 4-4.5 4S0 8.5 0 6.5v-4L4.5.5z" />
        </svg>
        {!compact && 'SE'}
      </button>
    </div>
  )
}
