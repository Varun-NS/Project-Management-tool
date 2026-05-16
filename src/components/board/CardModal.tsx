'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Task, List as ListType, Category, CATEGORY_COLORS, BoardMember } from '@/lib/mocks/board-data'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, AlignLeft, Users, Tag, CreditCard, ArrowRight, Copy, Trash2, ListMinus, MessageSquare, X, Palette, Check, UserX } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updateCardDetails, updateCardAssignees, deleteCard, createCard, createComment, updateBoardCategories, getBoardMembers } from '@/lib/actions/board'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

interface CardModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  setLists: React.Dispatch<React.SetStateAction<ListType[]>>
  lists: ListType[]
  boardCategories: Category[]
  setBoardCategories: React.Dispatch<React.SetStateAction<Category[]>>
  boardId: string
  isViewer?: boolean
}

type ActiveCardModalProps = Omit<CardModalProps, 'task'> & {
  task: Task
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || 'User').trim()
  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function CardModal(props: CardModalProps) {
  if (!props.task) return null

  return <CardModalContent {...props} task={props.task} />
}

function CardModalContent({ task, isOpen, onClose, setLists, lists, boardCategories, setBoardCategories, boardId, isViewer }: ActiveCardModalProps) {
  const [comment, setComment] = React.useState('')
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false)
  const [isMembersOpen, setIsMembersOpen] = React.useState(false)
  const [boardMembers, setBoardMembers] = React.useState<BoardMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false)
  const [isDeletingCard, setIsDeletingCard] = React.useState(false)
  const [newCategoryName, setNewCategoryName] = React.useState('')
  const [newCategoryColor, setNewCategoryColor] = React.useState<string>(CATEGORY_COLORS[0].value)

  React.useEffect(() => {
    if (task) {
      setTitle(task.content)
      setDescription(task.description || '')
      setIsDeleteConfirmOpen(false)
    }
  }, [task])

  const loadBoardMembers = React.useCallback(async () => {
    try {
      setIsLoadingMembers(true)
      const data = await getBoardMembers(boardId)
      setBoardMembers((data.members as BoardMember[]).filter(member => Boolean(member.user)))
    } catch (error: any) {
      toast.error(error.message || 'Failed to load board members')
    } finally {
      setIsLoadingMembers(false)
    }
  }, [boardId])

  React.useEffect(() => {
    if (isMembersOpen) loadBoardMembers()
  }, [isMembersOpen, loadBoardMembers])

  const parentList = lists.find(l => l.id === task.listId)

  const handleSaveComment = async () => {
    if (!comment.trim()) return
    const commentText = comment.trim()
    setComment('')
    
    // Optimistic Update
    const tempId = `temp-comment-${Date.now()}`
    const tempComment = {
      id: tempId,
      content: commentText,
      createdAt: new Date().toISOString(),
      user: { name: 'You', avatar: '' }
    }

    updateTaskLocally({ 
      comments: [tempComment, ...(task.comments || [])] 
    })

    try {
      const savedComment = await createComment(task.id, commentText)
      // Update with real comment ID from server
      setLists(prev => prev.map(list => {
        if (list.id === task.listId) {
          return {
            ...list,
            tasks: list.tasks.map(t => {
              if (t.id === task.id) {
                return {
                  ...t,
                  comments: (t.comments || []).map(c => c.id === tempId ? savedComment : c)
                }
              }
              return t
            })
          }
        }
        return list
      }))
    } catch (error) {
      toast.error("Failed to add comment")
      // Revert optimistic update on failure
      setLists(prev => prev.map(list => {
        if (list.id === task.listId) {
          return {
            ...list,
            tasks: list.tasks.map(t => t.id === task.id ? { ...t, comments: t.comments?.filter(c => c.id !== tempId) } : t)
          }
        }
        return list
      }))
    }
  }

  const updateTaskLocally = (updates: Partial<Task>) => {
    setLists(prev => prev.map(list => {
      if (list.id === task.listId) {
        return {
          ...list,
          tasks: list.tasks.map(t => t.id === task.id ? { ...t, ...updates } : t)
        }
      }
      return list
    }))
  }

  const handleSaveTitle = async () => {
    if (!title.trim() || title === task.content) {
      setIsEditingTitle(false)
      setTitle(task.content)
      return
    }

    const newTitle = title.trim()
    updateTaskLocally({ content: newTitle })
    setIsEditingTitle(false)

    try {
      await updateCardDetails(task.id, { title: newTitle })
    } catch (error) {
      toast.error("Failed to update title")
    }
  }

  const handleSaveDescription = async () => {
    if (description === task.description) {
      setIsEditingDescription(false)
      return
    }

    updateTaskLocally({ description })
    setIsEditingDescription(false)

    try {
      await updateCardDetails(task.id, { description })
      toast.success("Description saved")
    } catch (error) {
      toast.error("Failed to update description")
    }
  }

  const handleDeleteCard = async () => {
    if (isDeletingCard) return

    const deletedTask = task
    setIsDeletingCard(true)

    try {
      await deleteCard(deletedTask.id)
      setLists(prev => prev.map(list => {
        if (list.id === deletedTask.listId) {
          return { ...list, tasks: list.tasks.filter(t => t.id !== deletedTask.id) }
        }
        return list
      }))
      setIsDeleteConfirmOpen(false)
      onClose()
      toast.success("Card deleted")
    } catch (error: any) {
      toast.error(error.message || "Failed to delete card")
    } finally {
      setIsDeletingCard(false)
    }
  }

  const handleUpdateDate = async (date: Date | undefined) => {
    if (!date) return
    const formattedDate = date.toLocaleDateString()
    updateTaskLocally({ dueDate: formattedDate })
    try {
      await updateCardDetails(task.id, { due_date: date.toISOString() })
      toast.success("Due date updated")
    } catch (error) {
      toast.error("Failed to update due date on server")
    }
  }

  const handleUpdatePriority = async (priority: 'High' | 'Medium' | 'Low' | undefined) => {
    updateTaskLocally({ priority })
    try {
      await updateCardDetails(task.id, { priority: priority || null })
      toast.success(priority ? `Priority set to ${priority}` : 'Priority removed')
    } catch (error) {
      toast.error("Failed to update priority")
    }
  }

  const handleToggleMember = async (member: BoardMember) => {
    if (!member.user) return

    const currentAssignees = task.assignees || []
    const isAssigned = currentAssignees.some(assignee => assignee.id === member.user!.id)
    const assignee = {
      id: member.user.id,
      name: member.user.name || member.user.email || 'Unknown User',
      avatar: member.user.avatar_url || '',
    }
    const nextAssignees = isAssigned
      ? currentAssignees.filter(current => current.id !== member.user!.id)
      : [...currentAssignees, assignee]

    updateTaskLocally({ assignees: nextAssignees })

    try {
      await updateCardAssignees(task.id, nextAssignees.map(nextAssignee => nextAssignee.id))
      toast.success(isAssigned ? `Removed ${assignee.name}` : `Assigned ${assignee.name}`)
    } catch (error) {
      toast.error('Failed to update assignees')
    }
  }

  const handleUnassignMember = async () => {
    updateTaskLocally({ assignees: [] })

    try {
      await updateCardAssignees(task.id, [])
      toast.success('Assignees removed')
    } catch (error) {
      toast.error('Failed to remove assignees')
    }
  }

  // Create a new category in the board library and assign it to this card
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      color: newCategoryColor,
    }
    // Add to board library
    const updatedLibrary = [...boardCategories, newCat]
    setBoardCategories(updatedLibrary)
    // Add to this card
    const updatedCardCats = [...(task.categories || []), newCat]
    updateTaskLocally({ categories: updatedCardCats })
    setNewCategoryName('')
    setNewCategoryColor(CATEGORY_COLORS[0].value)
    try {
      await Promise.all([
        updateBoardCategories(boardId, updatedLibrary),
        updateCardDetails(task.id, { categories: updatedCardCats }),
      ])
    } catch (error) {
      toast.error("Failed to add category")
    }
  }

  // Toggle a board category on/off for this card
  const handleToggleCategory = async (cat: Category) => {
    const currentCats = task.categories || []
    const isAssigned = currentCats.some(c => c.id === cat.id)
    const updated = isAssigned
      ? currentCats.filter(c => c.id !== cat.id)
      : [...currentCats, cat]
    updateTaskLocally({ categories: updated })
    try {
      await updateCardDetails(task.id, { categories: updated })
    } catch (error) {
      toast.error("Failed to update category")
    }
  }

  // Delete a category from the board library and remove from ALL cards
  const handleDeleteBoardCategory = async (catId: string) => {
    const updatedLibrary = boardCategories.filter(c => c.id !== catId)
    setBoardCategories(updatedLibrary)
    // Remove from all cards optimistically
    setLists(prev => prev.map(list => ({
      ...list,
      tasks: list.tasks.map(t => ({
        ...t,
        categories: (t.categories || []).filter(c => c.id !== catId)
      }))
    })))
    try {
      await updateBoardCategories(boardId, updatedLibrary)
      // Note: removing from all cards in DB would need a backend function;
      // for now, it's removed optimistically and will be cleaned on next save per card
    } catch (error) {
      toast.error("Failed to delete category")
    }
  }

  const handleRemoveCategory = async (catId: string) => {
    const updated = (task.categories || []).filter(c => c.id !== catId)
    updateTaskLocally({ categories: updated })
    try {
      await updateCardDetails(task.id, { categories: updated })
    } catch (error) {
      toast.error("Failed to remove category")
    }
  }

  const handleMoveCard = async (newListId: string) => {
    if (newListId === task.listId) return
    
    // Find new position
    const targetList = lists.find(l => l.id === newListId)
    const newPosition = targetList && targetList.tasks.length > 0 
      ? targetList.tasks[targetList.tasks.length - 1].position + 65536 
      : 65536

    // Optimistic Move
    setLists(prev => prev.map(list => {
      if (list.id === task.listId) {
        return { ...list, tasks: list.tasks.filter(t => t.id !== task.id) }
      }
      if (list.id === newListId) {
        return { ...list, tasks: [...list.tasks, { ...task, listId: newListId, position: newPosition }] }
      }
      return list
    }))
    onClose()

    try {
      await updateCardDetails(task.id, { list_id: newListId, position: newPosition })
      toast.success("Card moved")
    } catch (error: any) {
      toast.error(error.message || "Failed to move card")
    }
  }



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeletingCard && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-[95vw] md:max-w-[850px] lg:max-w-[1000px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl sm:rounded-2xl flex flex-col max-h-[90vh]"
      >
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl">
              <h3 className="text-base font-semibold text-foreground">Delete this card?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This will permanently delete the card and its comments.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeletingCard}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteCard}
                  disabled={isDeletingCard}
                >
                  {isDeletingCard ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="shrink-0 bg-muted/20 px-6 py-5 md:px-8 border-b border-border/40 relative">
          <div className="flex items-start gap-4 pr-8">
            <CreditCard className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <Input 
                  autoFocus
                  className="min-w-0 text-xl md:text-2xl font-semibold leading-tight bg-background border-border"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                />
              ) : (
                <DialogTitle 
                  className={`max-w-full whitespace-normal break-words text-xl md:text-2xl font-semibold leading-tight text-foreground bg-transparent border-none p-0 m-0 w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md transition-colors [overflow-wrap:anywhere] ${
                    isViewer ? '' : 'cursor-pointer hover:bg-muted/50'
                  }`}
                  onClick={() => !isViewer && setIsEditingTitle(true)}
                >
                  {task.content}
                </DialogTitle>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                <p className="min-w-0 break-words [overflow-wrap:anywhere]">
                  in list <span className="underline underline-offset-2 cursor-pointer font-medium hover:text-foreground">{parentList?.title || 'Unknown List'}</span>
                </p>
                {task.priority && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider h-5 px-1.5 bg-background ${
                      task.priority === 'High' ? 'text-destructive border-destructive/50' : 
                      task.priority === 'Medium' ? 'text-orange-500 border-orange-500/50' : 
                      'text-emerald-500 border-emerald-500/50'
                    }`}>
                      {task.priority} Priority
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-10">
            
            {/* Left Column (Main Content) */}
            <div className="flex-1 space-y-10 min-w-0">
              
              {/* Meta Data Row */}
              <div className="flex flex-wrap gap-8 items-start">
                {task.assignees && task.assignees.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Members</h4>
                    <div className="flex items-center flex-wrap gap-2">
                      {task.assignees.map((assignee) => (
                        <Avatar
                          key={assignee.id}
                          title={assignee.name}
                          className="w-8 h-8 md:w-9 md:h-9 border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        >
                          <AvatarImage src={assignee.avatar} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                            {assignee.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {!isViewer && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setIsMembersOpen(true)}
                          className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted/30 border-dashed hover:bg-muted/60 hover:border-primary/50 text-muted-foreground transition-all shrink-0"
                        >
                          <PlusIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {task.dueDate && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Due Date</h4>
                    <Popover>
                      <PopoverTrigger className="inline-flex items-center justify-start whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border h-9 px-3 font-medium bg-muted/20 hover:bg-muted/60 border-border/50 text-sm">
                        <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
                        {task.dueDate}
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={new Date(task.dueDate)}
                          onSelect={(date) => date && handleUpdateDate(date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Categories Display */}
                {task.categories && task.categories.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Categories</h4>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {task.categories.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex max-w-full items-center gap-1 break-words text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer group/cat transition-all hover:opacity-80 [overflow-wrap:anywhere]"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}35` }}
                        >
                          {cat.name}
                          {!isViewer && (
                            <button onClick={() => handleRemoveCategory(cat.id)} className="opacity-0 group-hover/cat:opacity-100 transition-opacity ml-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                  <h3 className="font-semibold text-lg tracking-tight">Description</h3>
                  {!isViewer && !isEditingDescription && (
                    <Button variant="secondary" size="sm" className="ml-auto h-7 text-xs font-medium" onClick={() => setIsEditingDescription(true)}>
                      Edit
                    </Button>
                  )}
                </div>
                <div className="pl-8">
                  {isEditingDescription ? (
                    <div className="space-y-3">
                      <Textarea 
                        autoFocus
                        className="min-h-[120px] bg-background border-border focus-visible:ring-primary/50"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a more detailed description..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsEditingDescription(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className={`bg-muted/20 p-4 rounded-xl border border-border/40 text-sm text-foreground/80 leading-relaxed min-h-[120px] ${
                        isViewer ? '' : 'hover:bg-muted/40 transition-colors cursor-pointer'
                      }`}
                      onClick={() => !isViewer && setIsEditingDescription(true)}
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{task.description}</p>
                      ) : (
                        <span className="text-muted-foreground">Add a more detailed description...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <ListMinus className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex items-center justify-between flex-1">
                    <h3 className="font-semibold text-lg tracking-tight">Activity</h3>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-medium text-muted-foreground">
                      Show details
                    </Button>
                  </div>
                </div>

                <div className="pl-8 space-y-6">
                  {/* Comment Input */}
                  {!isViewer && (
                    <div className="flex gap-4">
                      <Avatar className="w-8 h-8 mt-1 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/20 text-primary font-medium">Y</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <div className="bg-card border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all rounded-xl shadow-sm overflow-hidden">
                          <Textarea 
                            placeholder="Write a comment..." 
                            className="min-h-[80px] border-0 focus-visible:ring-0 resize-none bg-transparent p-3 text-sm"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                          <div className="px-3 py-2 bg-muted/20 flex items-center justify-between border-t border-border/40">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <Button 
                              size="sm" 
                              className="h-7 px-3 text-xs font-medium"
                              onClick={handleSaveComment}
                              disabled={!comment.trim()}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    {/* Render Real Comments */}
                    <div className="space-y-5">
                      {task.comments?.map((c) => (
                        <div key={c.id} className="flex gap-4 group">
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={c.user.avatar} />
                            <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-500 font-medium">
                              {c.user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{c.user.name}</span>
                              <span className="text-xs text-muted-foreground" title={new Date(c.createdAt).toLocaleString()}>
                                {new Date(c.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="bg-muted/30 border border-border/40 p-3 rounded-xl rounded-tl-none text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {c.content}
                            </div>
                            {/* Only show comment actions if they are the author (currently omitted, but we hide entirely for viewers) */}
                            {!isViewer && (
                              <div className="flex items-center gap-3 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-all">Edit</button>
                                <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-all">Reply</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!task.comments || task.comments.length === 0) && (
                        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-lg">
                          No comments yet. Be the first to start the conversation!
                        </div>
                      )}
                    </div>
                </div>
              </div>
              
            </div>

            {/* Right Sidebar (Actions) */}
            <div className="w-full md:w-[220px] shrink-0 space-y-8">
              
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Add to card</h4>
                <div className="flex flex-col gap-2">
                  <Popover open={isMembersOpen} onOpenChange={setIsMembersOpen}>
                    <PopoverTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <Users className="w-4 h-4 mr-2.5 opacity-70" /> Members
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[300px] p-0" sideOffset={8}>
                      <div className="p-3 border-b border-border/40">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Assign members</h4>
                      </div>
                      <div className="max-h-[320px] overflow-y-auto p-2">
                        {isLoadingMembers ? (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading members...</div>
                        ) : boardMembers.length > 0 ? (
                          <div className="space-y-1">
                            {boardMembers.map((member) => {
                              const user = member.user!
                              const isAssigned = task.assignees?.some(assignee => assignee.id === user.id)
                              const name = user.name || user.email || 'Unknown User'

                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => handleToggleMember(member)}
                                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
                                >
                                  <Avatar>
                                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={name} />}
                                    <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">{name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                                  </div>
                                  {isAssigned && <Check className="h-4 w-4 text-primary" />}
                                </button>
                              )
                            })}

                            {(task.assignees?.length || 0) > 0 && (
                              <button
                                type="button"
                                onClick={handleUnassignMember}
                                className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                              >
                                <UserX className="h-4 w-4" />
                                Remove assignee
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            Invite members to this board before assigning cards.
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <Tag className="w-4 h-4 mr-2.5 opacity-70" /> Priority
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Priority</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdatePriority('High')} className="text-destructive font-medium cursor-pointer">High Priority</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdatePriority('Medium')} className="text-orange-500 font-medium cursor-pointer">Medium Priority</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdatePriority('Low')} className="text-emerald-500 font-medium cursor-pointer">Low Priority</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdatePriority(undefined)} className="text-muted-foreground font-medium cursor-pointer">None</DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Category Manager */}
                  <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                    <PopoverTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <Palette className="w-4 h-4 mr-2.5 opacity-70" /> Categories
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[280px] p-0" sideOffset={8}>
                      <div className="p-3 border-b border-border/40">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Categories</h4>
                      </div>
                      <div className="p-3 space-y-3 max-h-[350px] overflow-y-auto">
                        {/* Board category library — toggle on/off for this card */}
                        {boardCategories.length > 0 && (
                          <div className="space-y-1">
                            {boardCategories.map((cat) => {
                              const isAssigned = (task.categories || []).some(c => c.id === cat.id)
                              return (
                                <div key={cat.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors group">
                                  <button
                                    onClick={() => handleToggleCategory(cat)}
                                    className="flex items-center gap-2 flex-1 text-left"
                                  >
                                    <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
                                      isAssigned ? 'border-transparent' : 'border-border'
                                    }`} style={isAssigned ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}>
                                      {isAssigned && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                    <span className="text-sm font-medium">{cat.name}</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBoardCategory(cat.id)}
                                    title="Delete from all cards"
                                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-0.5"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {boardCategories.length > 0 && (
                          <div className="border-t border-border/40" />
                        )}

                        {/* Create new category */}
                        <div className="space-y-2.5">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Create new</p>
                          <Input
                            placeholder="Category name..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                          />
                          <div className="grid grid-cols-5 gap-1.5">
                            {CATEGORY_COLORS.map((c) => (
                              <button
                                key={c.value}
                                title={c.name}
                                onClick={() => setNewCategoryColor(c.value)}
                                className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center ${
                                  newCategoryColor === c.value ? 'border-foreground scale-105' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: c.value }}
                              >
                                {newCategoryColor === c.value && <Check className="w-3 h-3 text-white" />}
                              </button>
                            ))}
                          </div>
                          <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
                            Add Category
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <CalendarIcon className="w-4 h-4 mr-2.5 opacity-70" /> Dates
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={task.dueDate ? new Date(task.dueDate) : new Date()}
                        onSelect={(date) => {
                          if (date) handleUpdateDate(date);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">Actions</h4>
                <div className="flex flex-col gap-2">
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <ArrowRight className="w-4 h-4 mr-2.5 opacity-70" /> Move
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Move to list...</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {lists.map(list => (
                          <DropdownMenuItem 
                            key={list.id} 
                            onClick={() => handleMoveCard(list.id)}
                            className={list.id === task.listId ? "opacity-50 pointer-events-none" : "cursor-pointer"}
                          >
                            {list.title} {list.id === task.listId && "(Current)"}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>



                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-9 px-3 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2.5 opacity-70" /> Delete
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
