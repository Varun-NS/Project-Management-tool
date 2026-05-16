import { Bell } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { AvatarMenu } from './AvatarMenu'
import { HeaderBoardSelector } from './HeaderBoardSelector'
import { getCurrentUserProfile, getUserBoards } from '@/lib/actions/board'

export async function Header() {
  const [boards, currentUser] = await Promise.all([
    getUserBoards(),
    getCurrentUserProfile(),
  ])

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-5 sticky top-0 z-10">
      <div className="flex min-w-0 flex-1 items-center gap-5">
        {/* App Logo */}
        <div className="flex h-10 shrink-0 items-center gap-2.5">
          <Image
            src="/flowsphere-mark.svg"
            alt=""
            width={34}
            height={34}
            priority
            className="h-8 w-8"
          />
          <span className="hidden text-[1.35rem] font-extrabold leading-none tracking-normal sm:inline-flex">
            <span className="text-foreground">Flow</span>
            <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Sphere
            </span>
          </span>
        </div>

        {/* Divider */}
        {currentUser && <div className="h-8 w-px bg-border/60" />}

        {/* Board Selector + Create Board */}
        {currentUser && (
          <div className="flex shrink-0 items-center gap-3">
            <HeaderBoardSelector boards={boards} />
          </div>
        )}

      </div>

      {currentUser && (
        <div className="ml-4 flex shrink-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bell className="h-5 w-5" />
          </Button>
          <AvatarMenu user={currentUser} />
        </div>
      )}
    </header>
  )
}
