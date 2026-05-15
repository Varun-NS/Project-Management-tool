'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBoard, deleteBoard, renameBoard } from '@/lib/actions/board'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function SidebarBoardList({ boards: initialBoards }: { boards: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [boards, setBoards] = useState(initialBoards)
  const activeBoardId = searchParams.get('boardId') || (boards.length > 0 ? boards[0].id : null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; boardId: string; boardTitle: string } | null>(null)

  // Rename state
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ boardId: string; boardTitle: string } | null>(null)

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    setIsCreating(true)
    try {
      const board = await createBoard(newBoardName.trim())
      setBoards(prev => [...prev, board])
      setIsOpen(false)
      setNewBoardName('')
      router.push(`/?boardId=${board.id}`)
      toast.success("Board created successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to create board")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRequestDelete = (boardId: string, boardTitle: string) => {
    setContextMenu(null)
    setDeleteConfirm({ boardId, boardTitle })
  }

  const handleDeleteBoard = async () => {
    if (!deleteConfirm) return
    const { boardId, boardTitle } = deleteConfirm
    setDeleteConfirm(null)
    // Optimistic removal
    setBoards(prev => prev.filter(b => b.id !== boardId))
    
    // If deleting the active board, navigate to another
    if (boardId === activeBoardId) {
      const remaining = boards.filter(b => b.id !== boardId)
      if (remaining.length > 0) {
        router.push(`/?boardId=${remaining[0].id}`)
      } else {
        router.push('/')
      }
    }

    try {
      await deleteBoard(boardId)
      toast.success(`"${boardTitle}" deleted`)
    } catch (error: any) {
      toast.error(error.message || "Failed to delete board")
      setBoards(initialBoards)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, boardId: string, boardTitle: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, boardId, boardTitle })
  }

  const handleStartRename = (boardId: string, boardTitle: string) => {
    setContextMenu(null)
    setRenamingBoardId(boardId)
    setRenameValue(boardTitle)
  }

  const handleRenameBoard = async () => {
    if (!renamingBoardId || !renameValue.trim()) {
      setRenamingBoardId(null)
      return
    }
    const newTitle = renameValue.trim()
    const boardId = renamingBoardId
    // Optimistic
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: newTitle } : b))
    setRenamingBoardId(null)
    try {
      await renameBoard(boardId, newTitle)
      toast.success('Board renamed')
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename board')
      setBoards(initialBoards)
    }
  }

  const pastelColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-rose-500'
  ]

  return (
    <>
      <div className="px-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Boards</h3>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-5 w-5 text-muted-foreground hover:text-foreground">
              <Plus className="h-4 w-4" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Board</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="e.g. Marketing Campaign"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>Cancel</Button>
                <Button onClick={handleCreateBoard} disabled={isCreating || !newBoardName.trim()}>
                  {isCreating ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-1">
          {boards.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-1">No boards yet</div>
          ) : (
            boards.map((board, i) => {
              const isActive = board.id === activeBoardId
              const color = pastelColors[i % pastelColors.length]

              if (renamingBoardId === board.id) {
                return (
                  <div key={board.id} className="flex items-center gap-2 px-3 py-1.5">
                    <div className={`w-2 h-2 rounded-sm shrink-0 ${color}`} />
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameBoard}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameBoard()
                        if (e.key === 'Escape') setRenamingBoardId(null)
                      }}
                      className="h-7 text-sm px-2"
                    />
                  </div>
                )
              }

              return (
                <Button 
                  key={board.id} 
                  variant={isActive ? "secondary" : "ghost"} 
                  className={`w-full justify-start font-normal ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => router.push(`/?boardId=${board.id}`)}
                  onContextMenu={(e) => handleContextMenu(e, board.id, board.title)}
                >
                  <div className={`w-2 h-2 rounded-sm mr-2 ${color}`} />
                  {board.title}
                </Button>
              )
            })
          )}
        </div>
      </div>

      {/* Native-style context menu */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-50" 
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
          />
          <div
            className="fixed z-50 min-w-[160px] rounded-lg bg-popover p-1 shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => handleStartRename(contextMenu.boardId, contextMenu.boardTitle)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Rename Board
            </button>
            <button
              onClick={() => handleRequestDelete(contextMenu.boardId, contextMenu.boardTitle)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Board
            </button>
          </div>
        </>
      )}
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Board</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirm?.boardTitle}"</span>? This will permanently remove all lists, cards, and comments in this board.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteBoard}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
