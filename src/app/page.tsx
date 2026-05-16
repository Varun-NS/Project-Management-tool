import { Board } from '@/components/board/Board'
import { BoardMembers } from '@/components/board/BoardMembers'
import { getUserBoards, createBoard, getCurrentUser, fetchBoardData, getBoardMembers } from '@/lib/actions/board'
import { redirect } from 'next/navigation'

export default async function Home(props: { searchParams: Promise<{ boardId?: string }> }) {
  const [searchParams, boards] = await Promise.all([
    props.searchParams,
    getUserBoards(),
  ])

  if (boards.length === 0) {
    const newBoard = await createBoard('My First Board')
    redirect(`/?boardId=${newBoard.id}`)
  }

  if (!searchParams.boardId) {
    redirect(`/?boardId=${boards[0].id}`)
  }

  const activeBoard = boards.find(b => b.id === searchParams.boardId) || boards[0]
  
  const [currentUser, boardData, membersData] = await Promise.all([
    getCurrentUser(),
    fetchBoardData(activeBoard.id),
    getBoardMembers(activeBoard.id),
  ])

  const initialMembers = membersData.members.map((m: any) => m.user).filter(Boolean)
  const currentUserMember = membersData.members.find((m: any) => m.user_id === currentUser?.id)
  const initialIsViewer = currentUserMember?.role === 'viewer'

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
        <Board 
          key={activeBoard.id}
          boardId={activeBoard.id} 
          currentUserId={currentUser?.id} 
          initialLists={boardData.lists}
          initialCategories={boardData.boardCategories || []}
          initialMembers={initialMembers}
          initialIsViewer={initialIsViewer}
        />
      </div>
    </div>
  )
}
