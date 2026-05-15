'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export const BACKGROUND_COLORS = [
  // ── Large gradient cards (first 10) ──
  { name: 'Deep Navy',       value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' },
  { name: 'Arctic Blue',     value: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)' },
  { name: 'Ocean Blue',      value: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' },
  { name: 'Twilight',        value: 'linear-gradient(135deg, #6366f1 0%, #d946ef 100%)' },
  { name: 'Lavender Dream',  value: 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)' },
  { name: 'Sunset Orange',   value: 'linear-gradient(135deg, #f97316 0%, #f43f5e 100%)' },
  { name: 'Rose Pink',       value: 'linear-gradient(135deg, #fb7185 0%, #f472b6 100%)' },
  { name: 'Tropical Teal',   value: 'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)' },
  { name: 'Midnight Storm',  value: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
  { name: 'Burgundy',        value: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' },

  // ── Small solid color squares (last 10) ──
  { name: 'Blue',            value: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' },
  { name: 'Orange',          value: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' },
  { name: 'Green',           value: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' },
  { name: 'Crimson',         value: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)' },
  { name: 'Purple',          value: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' },
  { name: 'Hot Pink',        value: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' },
  { name: 'Emerald',         value: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' },
  { name: 'Cyan',            value: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)' },
  { name: 'Slate',           value: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)' },
  { name: 'Dark Plum',       value: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)' },
] as const

type BackgroundContextType = {
  background: string
  setBackground: (bg: string) => void
}

const BackgroundContext = createContext<BackgroundContextType>({
  background: '',
  setBackground: () => {},
})

export function useBackground() {
  return useContext(BackgroundContext)
}

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [background, setBackgroundState] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('board-background')
    if (saved) setBackgroundState(saved)
    setMounted(true)
  }, [])

  const setBackground = (bg: string) => {
    setBackgroundState(bg)
    if (bg) {
      localStorage.setItem('board-background', bg)
    } else {
      localStorage.removeItem('board-background')
    }
  }

  if (!mounted) return <>{children}</>

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  )
}
