'use client'

import { useBackground } from '@/components/providers/BackgroundProvider'

export function MainArea({ children }: { children: React.ReactNode }) {
  const { background } = useBackground()

  return (
    <main
      className="flex-1 overflow-hidden flex flex-col relative transition-all duration-500"
      style={background ? { background } : undefined}
    >
      {children}
    </main>
  )
}
