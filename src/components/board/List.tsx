import { useState } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { MoreHorizontal, Plus, Trash2, Edit2, Palette, X } from 'lucide-react'
import { List as ListType, Task, LIST_COLORS } from '@/lib/mocks/board-data'
import { Card } from './Card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createCard, deleteList, renameList, updateListColor } from '@/lib/actions/board'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ListProps {
  list: ListType
  index: number
  onTaskClick: (task: Task) => void
  boardId: string | null
  setLists: React.Dispatch<React.SetStateAction<ListType[]>>
}

export function List({ list, index, onTaskClick, boardId, setLists }: ListProps) {
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [listTitle, setListTitle] = useState(list.title)
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return

    const title = newCardTitle.trim()
    const newPosition = list.tasks.length > 0 ? list.tasks[list.tasks.length - 1].position + 65536 : 65536
    
    // Optimistic Update
    const tempId = `temp-card-${Date.now()}`
    const newTask = { id: tempId, listId: list.id, content: title, position: newPosition }
    
    setLists(prev => prev.map(l => {
      if (l.id === list.id) return { ...l, tasks: [...l.tasks, newTask] }
      return l
    }))

    setNewCardTitle('')
    setIsAddingCard(false)

    try {
      const savedCard = await createCard(list.id, title, newPosition)
      // We need to update the card in the parent state to have the real ID
      setLists(currentLists => currentLists.map(l => 
        l.id === list.id 
          ? { ...l, tasks: l.tasks.map(t => t.id === tempId ? { ...t, id: savedCard.id } : t) }
          : l
      ))
    } catch (error: any) {
      toast.error(error.message || "Failed to create task on server")
      // We keep the optimistic update so the UI remains functional
    }
  }

  const handleDeleteList = async () => {
    if (!confirm("Are you sure you want to delete this list?")) return
    
    // Optimistic update
    setLists(prev => prev.filter(l => l.id !== list.id))
    try {
      await deleteList(list.id)
      toast.success("List deleted")
    } catch (error) {
      toast.error("Failed to delete list")
      // Ideal implementation would revert here
    }
  }

  const handleRenameList = async () => {
    if (!listTitle.trim() || listTitle === list.title) {
      setIsEditingTitle(false)
      return
    }

    const newTitle = listTitle.trim()
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, title: newTitle } : l))
    setIsEditingTitle(false)

    try {
      await renameList(list.id, newTitle)
    } catch (error) {
      toast.error("Failed to rename list")
    }
  }

  const handleColorChange = async (color: string | null) => {
    // Optimistic update
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, color: color || undefined } : l))
    setIsColorPickerOpen(false)

    try {
      await updateListColor(list.id, color)
    } catch (error) {
      toast.error("Failed to update list color")
    }
  }

  return (
    <Draggable draggableId={list.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`w-80 flex flex-col flex-shrink-0 rounded-xl max-h-full border overflow-hidden transition-colors duration-300 ${
            snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''
          } ${list.color ? 'border-transparent' : 'bg-muted/40 border-border/50'}`}
          style={{
            ...provided.draggableProps.style,
            ...(list.color ? { backgroundColor: list.color } : {}),
          }}
        >
          <div 
            {...provided.dragHandleProps}
            className={`p-3 flex items-center justify-between group cursor-grab active:cursor-grabbing ${
              list.color ? 'text-white' : ''
            }`}
          >
            <div className="flex items-center gap-2 flex-1 mr-2">
              {isEditingTitle ? (
                <Input 
                  autoFocus
                  className="h-7 text-sm font-semibold px-2"
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  onBlur={handleRenameList}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameList()}
                />
              ) : (
                <h3 
                  className={`font-semibold text-sm px-1 cursor-pointer rounded flex-1 ${
                    list.color ? 'hover:bg-white/15' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setIsEditingTitle(true)}
                >
                  {list.title}
                </h3>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                list.color ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {list.tasks.length}
              </span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-6 w-6 ${
                list.color ? 'text-white/70 hover:text-white hover:bg-white/15' : 'text-muted-foreground'
              }`}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setIsColorPickerOpen(true) }}>
                  <Palette className="w-4 h-4 mr-2" /> Color
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDeleteList} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Delete List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Color Picker Popover */}
            <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
              <PopoverTrigger className="hidden" />
              <PopoverContent align="end" className="w-[220px] p-3" sideOffset={8}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">List Color</h4>
                    <button 
                      onClick={() => setIsColorPickerOpen(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {LIST_COLORS.map((c) => (
                      <button
                        key={c.value}
                        title={c.name}
                        onClick={() => handleColorChange(c.value)}
                        className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 hover:shadow-md ${
                          list.color === c.value 
                            ? 'border-foreground shadow-sm scale-105' 
                            : 'border-transparent hover:border-border'
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  {list.color && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => handleColorChange(null)}
                    >
                      <X className="w-3 h-3 mr-1.5" /> Remove color
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Droppable droppableId={list.id} type="task">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 px-3 pb-3 overflow-y-auto space-y-3 min-h-[150px] transition-colors ${
                  snapshot.isDraggingOver ? 'bg-primary/5 rounded-lg' : ''
                }`}
              >
                {list.tasks.map((task, index) => (
                  <Card key={task.id} task={task} index={index} onClick={() => onTaskClick(task)} />
                ))}
                {provided.placeholder}
                
                {isAddingCard && (
                  <div className="bg-card rounded-lg p-3 shadow-sm border border-border space-y-3">
                    <Textarea 
                      autoFocus
                      placeholder="Enter a title for this card..."
                      className="min-h-[60px] text-sm resize-none border-0 focus-visible:ring-0 p-0"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddCard()
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleAddCard}>Add Card</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsAddingCard(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Droppable>

          {!isAddingCard && (
            <div className={`p-2 ${
              list.color ? 'border-t border-white/15' : 'border-t border-border/50'
            }`}>
              <Button 
                variant="ghost" 
                className={`w-full justify-start ${
                  list.color 
                    ? 'text-white/80 hover:text-white hover:bg-white/15' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setIsAddingCard(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add a card
              </Button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
