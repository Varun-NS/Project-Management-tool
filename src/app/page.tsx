import { Board } from '@/components/board/Board'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
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
      <div className="h-14 border-b border-border/50 flex items-center px-6 bg-background/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">{activeBoard.title}</h1>
          <div className="w-px h-5 bg-border/50" />
          <Button variant="secondary" size="sm" className="hidden md:flex h-8 text-xs">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Team
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
