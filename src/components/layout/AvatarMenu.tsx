'use client'

import * as React from 'react'
import { LogOut, Paintbrush, Check, ChevronLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signout } from '@/app/auth/actions'
import { useBackground, BACKGROUND_COLORS } from '@/components/providers/BackgroundProvider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Split into gradient cards (first 10) and solid colors (last 10)
const GRADIENT_CARDS = BACKGROUND_COLORS.slice(0, 10)
const SOLID_COLORS = BACKGROUND_COLORS.slice(10, 20)

type AvatarMenuUser = {
  id: string
  name?: string | null
  email?: string | null
  avatar_url?: string | null
} | null

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || 'User').trim()
  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

export function AvatarMenu({ user }: { user: AvatarMenuUser }) {
  const { background, setBackground } = useBackground()
  const [isOpen, setIsOpen] = React.useState(false)
  const [showColors, setShowColors] = React.useState(false)
  const initials = getInitials(user?.name, user?.email)

  const selectColor = (value: string) => {
    setBackground(value)
    setIsOpen(false)
    setShowColors(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setShowColors(false) }}>
      <PopoverTrigger className="focus-visible:outline-none rounded-full">
        <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
          {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name || user.email || 'User'} />}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0" sideOffset={8} style={{ width: 360 }}>
        {!showColors ? (
          <div className="p-1.5">
            <div className="px-2.5 py-2">
              <div className="text-xs font-medium text-muted-foreground">My Account</div>
              {user?.email && (
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {user.name || user.email}
                </div>
              )}
            </div>
            <div className="h-px bg-border/50 mx-1 my-1" />
            <button
              onClick={() => setShowColors(true)}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Paintbrush className="w-4 h-4 text-muted-foreground" />
              Change Background
            </button>
            <div className="h-px bg-border/50 mx-1 my-1" />
            <form action={signout}>
              <button type="submit" className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </form>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowColors(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-sm font-semibold flex-1 text-center pr-6">Colors</h4>
            </div>

            {/* Large gradient cards - 2 columns like Trello */}
            <div className="grid grid-cols-2 gap-2">
              {GRADIENT_CARDS.map((color) => {
                const isSelected = background === color.value
                return (
                  <button
                    key={color.name}
                    title={color.name}
                    onClick={() => selectColor(color.value)}
                    className={`h-20 rounded-xl border-2 transition-all hover:scale-[1.02] flex items-end justify-start p-2 ${
                      isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border/60'
                    }`}
                    style={{ background: color.value }}
                  >
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-black/30 flex items-center justify-center ml-auto mb-auto -mt-0.5 -mr-0.5">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div className="h-px bg-border/40" />

            {/* Small solid colors - 5 columns like Trello */}
            <div className="grid grid-cols-5 gap-2">
              {/* None / Reset */}
              <button
                onClick={() => selectColor('')}
                className={`aspect-square rounded-lg border-2 transition-all hover:scale-105 flex items-center justify-center text-[10px] font-medium text-muted-foreground ${
                  !background ? 'border-primary ring-1 ring-primary/20' : 'border-border/40 hover:border-border'
                }`}
                title="Default"
              >
                {!background ? <Check className="w-3.5 h-3.5 text-primary" /> : 'None'}
              </button>

              {SOLID_COLORS.map((color) => {
                const isSelected = background === color.value
                return (
                  <button
                    key={color.name}
                    title={color.name}
                    onClick={() => selectColor(color.value)}
                    className={`aspect-square rounded-lg border-2 transition-all hover:scale-105 flex items-center justify-center ${
                      isSelected ? 'border-primary ring-1 ring-primary/20 scale-105' : 'border-transparent hover:border-border/60'
                    }`}
                    style={{ background: color.value }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
