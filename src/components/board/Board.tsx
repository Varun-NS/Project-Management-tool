'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { List as ListComponent } from './List'
import { initialData, List, Task } from '@/lib/mocks/board-data'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CardModal } from './CardModal'
import { fetchBoardData, updateListPositions, updateCardPositions, createList } from '@/lib/actions/board'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

export function Board({ boardId }: { boardId: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [lists, setLists] = useState<List[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Inline list creation state
  const [isAddingList, setIsAddingList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsMounted(true)
    loadBoard()
  }, [boardId])

  const loadBoard = async () => {
    try {
      setIsLoading(true)
      const data = await fetchBoardData(boardId)
      setLists(data)
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
      } catch (error) {
        toast.error("Order saved locally. Database not connected.")
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
    removedTask.listId = destination.droppableId
    destTasks.splice(destination.index, 0, removedTask)

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
    } catch (error) {
      toast.error("Moved locally. Database not connected.")
      // Removing the revert so UI stays functional for demo
    }
  }

  if (!isMounted) return null

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="list" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex gap-4 h-full p-6 items-start overflow-x-auto"
            >
              {lists.map((list, index) => (
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
      />
    </>
  )
}
