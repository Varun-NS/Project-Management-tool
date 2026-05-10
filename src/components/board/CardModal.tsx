'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Task, List as ListType } from '@/lib/mocks/board-data'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, Clock, AlignLeft, Users, Tag, CreditCard, ArrowRight, Copy, Trash2, ListMinus, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { updateCardDetails, deleteCard, createCard, createComment } from '@/lib/actions/board'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

interface CardModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  setLists: React.Dispatch<React.SetStateAction<ListType[]>>
  lists: ListType[]
}

export function CardModal({ task, isOpen, onClose, setLists, lists }: CardModalProps) {
  const [comment, setComment] = React.useState('')
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [description, setDescription] = React.useState('')

  React.useEffect(() => {
    if (task) {
      setTitle(task.content)
      setDescription(task.description || '')
    }
  }, [task])

  if (!task) return null

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
    if (!confirm("Are you sure you want to delete this card?")) return

    // Optimistic delete
    setLists(prev => prev.map(list => {
      if (list.id === task.listId) {
        return { ...list, tasks: list.tasks.filter(t => t.id !== task.id) }
      }
      return list
    }))
    onClose()

    try {
      await deleteCard(task.id)
      toast.success("Card deleted")
    } catch (error) {
      toast.error("Failed to delete card")
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

  const handleUpdatePriority = async (priority: 'High' | 'Medium' | 'Low') => {
    updateTaskLocally({ priority })
    try {
      await updateCardDetails(task.id, { priority })
      toast.success(`Priority set to ${priority}`)
    } catch (error) {
      toast.error("Failed to update priority")
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
    } catch (error) {
      toast.error("Failed to move card")
    }
  }

  const handleCopyCard = async () => {
    const newTitle = `${task.content} (Copy)`
    const newPosition = parentList && parentList.tasks.length > 0 
      ? parentList.tasks[parentList.tasks.length - 1].position + 65536 
      : 65536

    const tempId = `temp-${Date.now()}`
    const copiedTask = { ...task, id: tempId, content: newTitle, position: newPosition }
    
    setLists(prev => prev.map(list => {
      if (list.id === task.listId) {
        return { ...list, tasks: [...list.tasks, copiedTask] }
      }
      return list
    }))
    onClose()

    try {
      // In a real app we'd copy description etc. For now we use createCard
      const data = await createCard(task.listId, newTitle, newPosition)
      setLists(prev => prev.map(list => {
        if (list.id === task.listId) {
          return { ...list, tasks: list.tasks.map(t => t.id === tempId ? { ...t, id: data.id } : t) }
        }
        return list
      }))
      toast.success("Card copied")
    } catch (error) {
      toast.error("Failed to copy card")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-[95vw] md:max-w-[850px] lg:max-w-[1000px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-xl sm:rounded-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header Section */}
        <div className="shrink-0 bg-muted/20 px-6 py-5 md:px-8 border-b border-border/40 relative">
          <div className="flex items-start gap-4 pr-8">
            <CreditCard className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <Input 
                  autoFocus
                  className="text-xl md:text-2xl font-semibold leading-tight bg-background border-border"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                />
              ) : (
                <DialogTitle 
                  className="text-xl md:text-2xl font-semibold leading-tight text-foreground bg-transparent border-none p-0 m-0 w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {task.content}
                </DialogTitle>
              )}
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <p>
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
        <ScrollArea className="flex-1 overflow-y-auto">
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
                        <Avatar key={assignee.id} className="w-8 h-8 md:w-9 md:h-9 border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                          <AvatarImage src={assignee.avatar} />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                            {assignee.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      <Button variant="outline" size="icon" className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted/30 border-dashed hover:bg-muted/60 hover:border-primary/50 text-muted-foreground transition-all shrink-0">
                        <PlusIcon className="w-4 h-4" />
                      </Button>
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
              </div>

              {/* Description Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlignLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                  <h3 className="font-semibold text-lg tracking-tight">Description</h3>
                  {!isEditingDescription && (
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
                      className="bg-muted/20 hover:bg-muted/40 transition-colors p-4 rounded-xl border border-border/40 text-sm text-foreground/80 leading-relaxed cursor-pointer min-h-[120px]"
                      onClick={() => setIsEditingDescription(true)}
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap">{task.description}</p>
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
                  <div className="flex gap-4">
                    <Avatar className="w-8 h-8 mt-1 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary font-medium">VN</AvatarFallback>
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
                            <div className="bg-muted/30 border border-border/40 p-3 rounded-xl rounded-tl-none text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                              {c.content}
                            </div>
                            <div className="flex items-center gap-3 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-all">Edit</button>
                              <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-all">Reply</button>
                            </div>
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
                  <Button variant="secondary" className="w-full justify-start h-9 px-3 font-medium bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground" onClick={() => toast.success('Add Members clicked', { description: 'Needs User Auth integration.' })}>
                    <Users className="w-4 h-4 mr-2.5 opacity-70" /> Members
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full inline-flex items-center justify-start h-9 px-3 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground">
                      <Tag className="w-4 h-4 mr-2.5 opacity-70" /> Labels
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Priority</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdatePriority('High')} className="text-destructive font-medium cursor-pointer">High Priority</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdatePriority('Medium')} className="text-orange-500 font-medium cursor-pointer">Medium Priority</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdatePriority('Low')} className="text-emerald-500 font-medium cursor-pointer">Low Priority</DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

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

                  <Button variant="secondary" className="w-full justify-start h-9 px-3 font-medium bg-muted/40 hover:bg-muted text-foreground/80 hover:text-foreground" onClick={handleCopyCard}>
                    <Copy className="w-4 h-4 mr-2.5 opacity-70" /> Copy
                  </Button>

                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-9 px-3 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={handleDeleteCard}
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


