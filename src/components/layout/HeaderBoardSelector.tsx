'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, Edit2, ChevronDown, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBoard, deleteBoard, renameBoard } from '@/lib/actions/board'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const pastelColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-rose-500'
]

const pastelColorValues: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-emerald-500': '#10b981',
  'bg-purple-500': '#a855f7',
  'bg-pink-500': '#ec4899',
  'bg-amber-500': '#f59e0b',
  'bg-rose-500': '#f43f5e',
}

export function HeaderBoardSelector({ boards: initialBoards }: { boards: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [boards, setBoards] = useState(initialBoards)
  const activeBoardId = searchParams.get('boardId') || (boards.length > 0 ? boards[0].id : null)
  const activeBoard = boards.find(b => b.id === activeBoardId)

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Create board dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; boardId: string; boardTitle: string } | null>(null)

  // Rename state
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ boardId: string; boardTitle: string } | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    setIsCreating(true)
    try {
      const board = await createBoard(newBoardName.trim())
      setBoards(prev => [...prev, board])
      setIsCreateOpen(false)
      setNewBoardName('')
      router.push(`/?boardId=${board.id}`)
      toast.success("Board created successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to create board")
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectBoard = (boardId: string) => {
    router.push(`/?boardId=${boardId}`)
    setDropdownOpen(false)
  }

  const handleRequestDelete = (boardId: string, boardTitle: string) => {
    setContextMenu(null)
    setDeleteConfirm({ boardId, boardTitle })
  }

  const handleDeleteBoard = async () => {
    if (!deleteConfirm) return
    const { boardId, boardTitle } = deleteConfirm
    setDeleteConfirm(null)
    setBoards(prev => prev.filter(b => b.id !== boardId))

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

  const activeBoardIndex = boards.findIndex(b => b.id === activeBoardId)
  const activeBoardColor = activeBoardIndex >= 0 ? pastelColors[activeBoardIndex % pastelColors.length] : pastelColors[0]
  const activeBoardColorValue = pastelColorValues[activeBoardColor] || '#3b82f6'

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Board selector trigger */}
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex h-9 items-center gap-2.5 rounded-lg px-3.5 hover:bg-white/10 transition-all duration-200 group"
          id="board-selector-trigger"
        >
          <div
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeBoardColorValue }}
          />
          <span className="max-w-[180px] truncate text-sm font-semibold">
            {activeBoard?.title || 'Select Board'}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1.5 min-w-[240px] rounded-xl bg-popover/95 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/20 z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Boards</span>
              </div>
            </div>

            {/* Board list */}
            <div className="py-1.5 max-h-[280px] overflow-y-auto">
              {boards.length === 0 ? (
                <div className="text-xs text-muted-foreground px-3 py-2">No boards yet</div>
              ) : (
                boards.map((board, i) => {
                  const isActive = board.id === activeBoardId
                  const color = pastelColors[i % pastelColors.length]
                  const colorValue = pastelColorValues[color] || '#3b82f6'

                  if (renamingBoardId === board.id) {
                    return (
                      <div key={board.id} className="flex items-center gap-2 px-3 py-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: colorValue }}
                        />
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
                    <button
                      key={board.id}
                      onClick={() => handleSelectBoard(board.id)}
                      onContextMenu={(e) => handleContextMenu(e, board.id, board.title)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-primary/10 text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: colorValue }}
                      />
                      <span className="truncate">{board.title}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create board button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10"
        onClick={() => setIsCreateOpen(true)}
        title="Create new board"
        id="create-board-button"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Create Board Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button onClick={handleCreateBoard} disabled={isCreating || !newBoardName.trim()}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context menu */}
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
