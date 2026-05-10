import { LayoutDashboard, CheckSquare, Users, Settings, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import { SidebarBoardList } from './SidebarBoardList'
import { getUserBoards } from '@/lib/actions/board'

export async function Sidebar() {
  const boards = await getUserBoards()

  return (
    <aside className="w-64 border-r border-border bg-muted/20 h-[calc(100vh-3.5rem)] hidden md:flex flex-col">
      <ScrollArea className="flex-1 py-4">
        <div className="px-3 mb-6">
          <nav className="space-y-1">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <CheckSquare className="mr-2 h-4 w-4" />
              My Tasks
            </Button>
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Users className="mr-2 h-4 w-4" />
              Team
            </Button>
          </nav>
        </div>

        <SidebarBoardList boards={boards} />
      </ScrollArea>
      
      <div className="p-3 mt-auto border-t border-border/50">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
    </aside>
  )
}
