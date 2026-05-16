'use client'

import { useState, useEffect, useMemo } from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { List as ListComponent } from './List'
import { initialData, List, Task, Category } from '@/lib/mocks/board-data'
import { Button } from '@/components/ui/button'
import { Plus, Filter, Search, X } from 'lucide-react'
import { CardModal } from './CardModal'
import { fetchBoardData, updateListPositions, updateCardPositions, createList, updateBoardCategories } from '@/lib/actions/board'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function Board({ boardId }: { boardId: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [lists, setLists] = useState<List[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Inline list creation state
  const [isAddingList, setIsAddingList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [boardCategories, setBoardCategories] = useState<Category[]>([])

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
    loadBoard()
  }, [boardId])

  const loadBoard = async () => {
    try {
      setIsLoading(true)
      const data = await fetchBoardData(boardId)
      setLists(data.lists)
      setBoardCategories(data.boardCategories || [])
    } catch (error: any) {
      console.error("Failed to load board:", error)
      toast.error(error.message || "Failed to load board")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddList = async () => {
    if (!newListTitle.trim()) return
    
    const newPosition = lists.length > 0 ? lists[lists.length - 1].position + 65536 : 65536
    const title = newListTitle.trim()
    
    // Optimistic UI update
    const tempId = `temp-${Date.now()}`
    const newList = { id: tempId, title, tasks: [], position: newPosition }
    setLists([...lists, newList as any])
    setNewListTitle('')
    setIsAddingList(false)

    if (!boardId) {
      toast.error("List added locally, but Supabase is not connected.")
      return
    }

    try {
      const savedList = await createList(boardId, title, newPosition)
      // Replace temp ID with real ID
      setLists(current => current.map(l => l.id === tempId ? { ...l, id: savedList.id } : l))
    } catch (error: any) {
      console.error("Failed to create list:", error)
      toast.error(error.message || "Failed to create list on server")
      // We keep the optimistic update so the UI remains functional for the demo
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, type } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newLists = Array.from(lists)

    // Reordering lists
    if (type === 'list') {
      const [removed] = newLists.splice(source.index, 1)
      newLists.splice(destination.index, 0, removed)
      
      // Calculate new positions
      const updates = newLists.map((list, index) => ({
        id: list.id,
        position: (index + 1) * 65536
      }))

      setLists(newLists) // Optimistic update

      try {
        await updateListPositions(updates)
      } catch (error: any) {
        toast.error(error.message || "Order saved locally. Database not connected.")
        // Removing the revert so UI stays functional for demo
      }
      return
    }

    // Moving tasks
    const sourceListIndex = newLists.findIndex(list => list.id === source.droppableId)
    const destListIndex = newLists.findIndex(list => list.id === destination.droppableId)

    if (sourceListIndex === -1 || destListIndex === -1) return

    const sourceList = newLists[sourceListIndex]
    const destList = newLists[destListIndex]

    const sourceTasks = Array.from(sourceList.tasks)
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : Array.from(destList.tasks)

    const [removedTask] = sourceTasks.splice(source.index, 1)
    const movedTask = { ...removedTask, listId: destination.droppableId }
    destTasks.splice(destination.index, 0, movedTask)

    newLists[sourceListIndex] = { ...sourceList, tasks: sourceTasks }
    if (source.droppableId !== destination.droppableId) {
      newLists[destListIndex] = { ...destList, tasks: destTasks }
    }

    setLists(newLists) // Optimistic update

    // Calculate new position for the task
    const updates = destTasks.map((task, index) => ({
      id: task.id,
      list_id: destination.droppableId,
      position: (index + 1) * 65536
    }))

    try {
      await updateCardPositions(updates)
    } catch (error: any) {
      toast.error(error.message || "Moved locally. Database not connected.")
      // Removing the revert so UI stays functional for demo
    }
  }

  const query = searchQuery.toLowerCase().trim()
  const hasActiveFilters = query.length > 0 || filterPriority !== null

  const filteredLists = useMemo(() => {
    if (!hasActiveFilters) return lists
    return lists.map(list => ({
      ...list,
      tasks: list.tasks.filter(task => {
        // Search filter
        if (query) {
          const matchesTitle = task.content.toLowerCase().includes(query)
          const matchesDesc = (task.description || '').toLowerCase().includes(query)
          const matchesCategory = (task.categories || []).some(c => c.name.toLowerCase().includes(query))
          const matchesPriority = (task.priority || '').toLowerCase().includes(query)
          if (!matchesTitle && !matchesDesc && !matchesCategory && !matchesPriority) return false
        }
        // Priority filter
        if (filterPriority !== null) {
          if (filterPriority === 'None') {
            if (task.priority) return false
          } else {
            if (task.priority !== filterPriority) return false
          }
        }
        return true
      })
    }))
  }, [lists, query, filterPriority, hasActiveFilters])

  const totalFilteredCards = filteredLists.reduce((sum, l) => sum + l.tasks.length, 0)
  const totalCards = lists.reduce((sum, l) => sum + l.tasks.length, 0)

  if (!isMounted) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/30 bg-background/30 backdrop-blur-sm shrink-0">
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger className={`relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border h-9 px-4 ${
              hasActiveFilters ? 'border-primary text-primary bg-primary/10' : 'border-border bg-background hover:bg-accent hover:text-accent-foreground'
            }`}>
              <Filter className="w-4 h-4" />
              Filter
              {hasActiveFilters && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {totalFilteredCards}/{totalCards}
                </span>
              )}
            </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-0" sideOffset={8}>
            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search cards, categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-3 space-y-3">
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Priority</h4>
                <div className="flex flex-wrap gap-1.5">
                  {['High', 'Medium', 'Low', 'None'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPriority(filterPriority === p ? null : p)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        filterPriority === p
                          ? p === 'High' ? 'bg-destructive/15 text-destructive border-destructive/40'
                          : p === 'Medium' ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                          : p === 'Low' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                          : 'bg-muted text-foreground border-foreground/30'
                          : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="p-3 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => { setSearchQuery(''); setFilterPriority(null) }}
                >
                  <X className="w-3 h-3 mr-1.5" /> Clear all filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <button
            onClick={() => { setSearchQuery(''); setFilterPriority(null) }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="list" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-1 gap-4 p-6 items-start overflow-x-auto"
            >
              {filteredLists.map((list, index) => (
                <ListComponent 
                  key={list.id} 
                  list={list} 
                  index={index} 
                  onTaskClick={setSelectedTask}
                  boardId={boardId}
                  setLists={setLists}
                />
              ))}
              {provided.placeholder}
              
              <div className="w-80 flex-shrink-0">
                {!isAddingList ? (
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-12 bg-muted/40 border-dashed hover:bg-muted/60 text-muted-foreground"
                    onClick={() => setIsAddingList(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add another list
                  </Button>
                ) : (
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/50 shadow-sm space-y-3">
                    <Input 
                      autoFocus
                      placeholder="Enter list title..."
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleAddList}>Add List</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsAddingList(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <CardModal 
        task={lists.flatMap(l => l.tasks).find(t => t.id === selectedTask?.id) || selectedTask} 
        isOpen={!!selectedTask} 
        onClose={() => setSelectedTask(null)} 
        setLists={setLists}
        lists={lists}
        boardCategories={boardCategories}
        setBoardCategories={setBoardCategories}
        boardId={boardId}
      />
    </div>
  )
}
