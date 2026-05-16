'use client'

import { useState, useEffect, useMemo } from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { List as ListComponent } from './List'
import { initialData, List, Task, Category } from '@/lib/mocks/board-data'
import { Button } from '@/components/ui/button'
import { Plus, Filter, Search, X, Check, Tag, User, Calendar, Clock, BarChart2 } from 'lucide-react'
import { CardModal } from './CardModal'
import { fetchBoardData, updateListPositions, updateCardPositions, createList, updateBoardCategories, getBoardMembers } from '@/lib/actions/board'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BoardDashboard } from './BoardDashboard'

export function Board({ boardId }: { boardId: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [lists, setLists] = useState<List[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Inline list creation state
  const [isAddingList, setIsAddingList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [boardCategories, setBoardCategories] = useState<Category[]>([])
  const [boardMembers, setBoardMembers] = useState<any[]>([])

  // Filter state
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isDashboardOpen, setIsDashboardOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [filterCategories, setFilterCategories] = useState<string[]>([])
  const [filterMembers, setFilterMembers] = useState<string[]>([])
  const [filterDueDates, setFilterDueDates] = useState<string[]>([])

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
      
      const membersData = await getBoardMembers(boardId)
      setBoardMembers(membersData.members.map((m: any) => m.user).filter(Boolean))
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
  const hasActiveFilters = query.length > 0 || 
    filterPriority !== null || 
    filterCategories.length > 0 || 
    filterMembers.length > 0 || 
    filterDueDates.length > 0

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
          const matchesMember = (task.assignees || []).some((m: any) => m.name.toLowerCase().includes(query) || (m.email && m.email.toLowerCase().includes(query)))
          if (!matchesTitle && !matchesDesc && !matchesCategory && !matchesPriority && !matchesMember) return false
        }
        
        // Priority filter
        if (filterPriority !== null) {
          if (filterPriority === 'None') {
            if (task.priority) return false
          } else {
            if (task.priority !== filterPriority) return false
          }
        }

        // Category filter
        if (filterCategories.length > 0) {
          if (filterCategories.includes('no-label')) {
            if (task.categories?.length > 0) return false
          } else {
            const hasSelectedCategory = (task.categories || []).some(c => filterCategories.includes(c.id))
            if (!hasSelectedCategory) return false
          }
        }

        // Member filter
        if (filterMembers.length > 0) {
          if (filterMembers.includes('no-member')) {
            if (task.assignees?.length > 0) return false
          } else {
            const hasSelectedMember = (task.assignees || []).some(m => filterMembers.includes(m.id))
            if (!hasSelectedMember) return false
          }
        }

        // Due Date filter
        if (filterDueDates.length > 0) {
          let matchesDate = false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          for (const dateFilter of filterDueDates) {
            if (dateFilter === 'no-date' && !task.dueDate) {
              matchesDate = true; break;
            }
            if (task.dueDate) {
              const taskDate = new Date(task.dueDate);
              taskDate.setHours(0, 0, 0, 0);
              
              if (dateFilter === 'overdue' && taskDate < today) {
                matchesDate = true; break;
              }
              if (dateFilter === 'due-next-day' && taskDate.getTime() === tomorrow.getTime()) {
                matchesDate = true; break;
              }
            }
          }
          if (!matchesDate) return false;
        }

        return true
      })
    }))
  }, [lists, query, filterPriority, filterCategories, filterMembers, filterDueDates, hasActiveFilters])

  const clearFilters = () => {
    setSearchQuery('')
    setFilterPriority(null)
    setFilterCategories([])
    setFilterMembers([])
    setFilterDueDates([])
  }

  const totalFilteredCards = filteredLists.reduce((sum, l) => sum + l.tasks.length, 0)
  const totalCards = lists.reduce((sum, l) => sum + l.tasks.length, 0)

  // Filter dropdown options based on search query
  const filteredCategoryOptions = boardCategories.filter(c => c.name.toLowerCase().includes(query))
  const filteredMemberOptions = boardMembers.filter(m => m.name.toLowerCase().includes(query) || (m.email && m.email.toLowerCase().includes(query)))
  const dueDateOptions = [
    { id: 'no-date', label: 'No due date', icon: Calendar },
    { id: 'overdue', label: 'Overdue', icon: Clock, color: 'text-destructive' },
    { id: 'due-next-day', label: 'Due in the next day', icon: Calendar, color: 'text-amber-500' }
  ].filter(d => d.label.toLowerCase().includes(query))

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
                  placeholder="Search cards, members, labels..."
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
            
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              {/* Priority */}
              {['priority', 'high', 'medium', 'low', 'none'].some(p => p.includes(query)) && (
                <div className="px-3 py-3 border-b border-border/40 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    Priority
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['High', 'Medium', 'Low', 'None']
                      .filter(p => p.toLowerCase().includes(query) || query === '' || 'priority'.includes(query))
                      .map((p) => (
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
                        {filterPriority === p && <Check className="w-3 h-3 inline-block mr-1" />}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Members */}
              {(filteredMemberOptions.length > 0 || 'no members'.includes(query)) && (
                <div className="px-3 py-3 border-b border-border/40 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Members
                  </h4>
                  <div className="space-y-1">
                    {'no members'.includes(query) && (
                      <button
                        onClick={() => setFilterMembers(prev => prev.includes('no-member') ? prev.filter(id => id !== 'no-member') : [...prev, 'no-member'])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors text-sm text-left group"
                      >
                        <div className="w-6 h-6 rounded-full bg-muted border flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <span className="flex-1 truncate">No members</span>
                        {filterMembers.includes('no-member') ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </button>
                    )}
                    {filteredMemberOptions.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => setFilterMembers(prev => prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors text-sm text-left group"
                      >
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                            {member.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="flex-1 truncate">{member.name}</span>
                        {filterMembers.includes(member.id) ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Date */}
              {dueDateOptions.length > 0 && (
                <div className="px-3 py-3 border-b border-border/40 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> Due date
                  </h4>
                  <div className="space-y-1">
                    {dueDateOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setFilterDueDates(prev => prev.includes(option.id) ? prev.filter(id => id !== option.id) : [...prev, option.id])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors text-sm text-left group"
                      >
                        <div className={`w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 ${option.color ? option.color.replace('text-', 'bg-').replace('500', '500/10') : ''}`}>
                          <option.icon className={`w-3.5 h-3.5 ${option.color || 'text-muted-foreground'}`} />
                        </div>
                        <span className={`flex-1 truncate ${option.color || ''}`}>{option.label}</span>
                        {filterDueDates.includes(option.id) ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories/Labels */}
              {(filteredCategoryOptions.length > 0 || 'no labels'.includes(query)) && (
                <div className="px-3 py-3 space-y-2">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Labels
                  </h4>
                  <div className="space-y-1">
                    {'no labels'.includes(query) && (
                      <button
                        onClick={() => setFilterCategories(prev => prev.includes('no-label') ? prev.filter(id => id !== 'no-label') : [...prev, 'no-label'])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors text-sm text-left group"
                      >
                        <div className="w-4 h-4 rounded-full bg-muted border shrink-0 flex items-center justify-center">
                          <Tag className="w-2 h-2 text-muted-foreground" />
                        </div>
                        <span className="flex-1 truncate">No labels</span>
                        {filterCategories.includes('no-label') ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </button>
                    )}
                    {filteredCategoryOptions.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setFilterCategories(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded-md transition-colors text-sm text-left group"
                      >
                        <div 
                          className="w-4 h-4 rounded-full shrink-0" 
                          style={{ backgroundColor: cat.color }} 
                        />
                        <span className="flex-1 truncate">{cat.name}</span>
                        {filterCategories.includes(cat.id) ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="w-3 h-3 text-muted-foreground/50" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <div className="p-3 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3 mr-1.5" /> Clear all filters
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <div className="flex-1" />
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-4 gap-2 text-muted-foreground hover:text-foreground bg-background"
          onClick={() => setIsDashboardOpen(true)}
        >
          <BarChart2 className="w-4 h-4" />
          Dashboard
        </Button>
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

      <BoardDashboard 
        isOpen={isDashboardOpen} 
        onClose={() => setIsDashboardOpen(false)} 
        lists={lists} 
        boardCategories={boardCategories} 
        boardMembers={boardMembers} 
      />
    </div>
  )
}
