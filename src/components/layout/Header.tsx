import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AvatarMenu } from './AvatarMenu'

export function Header() {
  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <div className="font-semibold text-lg flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">P</div>
          Project Management Tool
        </div>
        
        <div className="hidden md:flex relative max-w-md w-full ml-4">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search boards, tasks, or members..." 
            className="w-full bg-muted/50 border-transparent focus-visible:border-ring pl-9 h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <AvatarMenu />
      </div>
    </header>
  )
}
