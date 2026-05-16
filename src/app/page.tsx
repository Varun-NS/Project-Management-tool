import { Board } from '@/components/board/Board'
import { BoardMembers } from '@/components/board/BoardMembers'
import { getUserBoards, createBoard, getCurrentUser } from '@/lib/actions/board'
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
  const currentUser = await getCurrentUser()

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="h-14 border-b border-border/50 flex items-center px-6 bg-background/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">{activeBoard.title}</h1>
          <div className="w-px h-5 bg-border/50" />
          <BoardMembers
            boardId={activeBoard.id}
            ownerId={activeBoard.created_by}
            currentUser={currentUser}
          />
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-hidden">
        <Board boardId={activeBoard.id} />
      </div>
    </div>
  )
}
