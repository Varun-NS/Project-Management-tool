import { Bell, Search } from 'lucide-react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AvatarMenu } from './AvatarMenu'
import { HeaderBoardSelector } from './HeaderBoardSelector'
import { getCurrentUserProfile, getUserBoards } from '@/lib/actions/board'

export async function Header() {
  const boards = await getUserBoards()
  const currentUser = await getCurrentUserProfile()

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
        <div className="h-8 w-px bg-border/60" />

        {/* Board Selector + Create Board */}
        <div className="flex shrink-0 items-center gap-3">
          <HeaderBoardSelector boards={boards} />
        </div>

        {/* Divider */}
        <div className="hidden h-8 w-px bg-border/60 md:block" />

        {/* Search */}
        <div className="hidden md:flex relative max-w-xl min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search boards, tasks, or members..." 
            className="h-10 w-full rounded-xl bg-muted/50 border-transparent pl-10 text-sm focus-visible:border-ring"
          />
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <AvatarMenu user={currentUser} />
      </div>
    </header>
  )
}
