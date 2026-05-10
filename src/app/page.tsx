import { Board } from '@/components/board/Board'
import { Button } from '@/components/ui/button'
import { Filter, Users, Calendar, MoreHorizontal } from 'lucide-react'
import { signout } from '@/app/auth/actions'
import { getUserBoards, createBoard } from '@/lib/actions/board'
import { redirect } from 'next/navigation'

export default async function Home(props: { searchParams: Promise<{ boardId?: string }> }) {
  const searchParams = await props.searchParams
  const boards = await getUserBoards()

  if (boards.length === 0) {
    const newBoard = await createBoard('My First Board')
    redirect(`/?boardId=${newBoard.id}`)
  }

  if (!searchParams.boardId) {
    redirect(`/?boardId=${boards[0].id}`)
  }

  const activeBoard = boards.find(b => b.id === searchParams.boardId) || boards[0]

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">{activeBoard.title}</h1>
          <Button variant="secondary" size="sm" className="hidden md:flex">
            <Users className="w-4 h-4 mr-2" />
            Team
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden md:flex">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </Button>
          <div className="w-px h-6 bg-border mx-2" />
          
          <form action={signout}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sign Out
            </Button>
          </form>
          
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-hidden">
        <Board boardId={activeBoard.id} />
      </div>
    </div>
  )
}
