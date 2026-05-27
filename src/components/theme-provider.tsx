'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type BrandTheme = 'cetiem' | 'institucional'

interface ThemeContextValue {
  theme: BrandTheme
  setTheme: (t: BrandTheme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'cetiem',
  setTheme: () => {},
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BrandTheme>('cetiem')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = (localStorage.getItem('brand-theme') ?? 'cetiem') as BrandTheme
    setThemeState(stored)
    applyTheme(stored)
    setMounted(true)
  }, [])

  function applyTheme(t: BrandTheme) {
    const html = document.documentElement
    html.setAttribute('data-theme', t)
    // Keep dark class for CETIEM, remove for institucional
    if (t === 'cetiem') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  function setTheme(t: BrandTheme) {
    setThemeState(t)
    localStorage.setItem('brand-theme', t)
    applyTheme(t)
  }

  function toggle() {
    setTheme(theme === 'cetiem' ? 'institucional' : 'cetiem')
  }

  // Prevent flash: apply stored theme before paint
  if (!mounted) {
    return (
      <>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('brand-theme')||'cetiem';document.documentElement.setAttribute('data-theme',t);if(t==='cetiem')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}`,
          }}
        />
        {children}
      </>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
