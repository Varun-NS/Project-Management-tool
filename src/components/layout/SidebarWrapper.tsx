'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="hidden md:flex h-full shrink-0 relative">
      {/* Sidebar content */}
      <div
        className={`border-r border-border bg-muted/20 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          collapsed ? 'w-0 border-r-0' : 'w-64'
        }`}
      >
        <div className="w-64 min-w-[16rem] h-full flex flex-col">
          {children}
        </div>
      </div>

      {/* Toggle button on the edge */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-lg hover:scale-110 transition-all duration-200"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}
