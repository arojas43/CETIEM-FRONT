'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
    >
      {dark
        ? <><Sun className="h-4 w-4 shrink-0" /><span>Modo claro</span></>
        : <><Moon className="h-4 w-4 shrink-0" /><span>Modo oscuro</span></>
      }
    </button>
  )
}
