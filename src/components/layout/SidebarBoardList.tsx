'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBoard } from '@/lib/actions/board'
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

export function SidebarBoardList({ boards }: { boards: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeBoardId = searchParams.get('boardId') || (boards.length > 0 ? boards[0].id : null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    setIsCreating(true)
    try {
      const board = await createBoard(newBoardName.trim())
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

  const pastelColors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-rose-500'
  ]

  return (
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
            return (
              <Button 
                key={board.id} 
                variant={isActive ? "secondary" : "ghost"} 
                className={`w-full justify-start font-normal ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => router.push(`/?boardId=${board.id}`)}
              >
                <div className={`w-2 h-2 rounded-sm mr-2 ${color}`} />
                {board.title}
              </Button>
            )
          })
        )}
      </div>
    </div>
  )
}
