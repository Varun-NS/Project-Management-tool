import { Draggable } from '@hello-pangea/dnd'
import { CalendarIcon, MessageSquare, Paperclip } from 'lucide-react'
import { Task } from '@/lib/mocks/board-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface CardProps {
  task: Task
  index: number
  onClick?: () => void
}

export function Card({ task, index, onClick }: CardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-card rounded-lg p-3 shadow-sm border border-border group hover:border-primary/50 transition-colors cursor-grab active:cursor-grabbing ${
            snapshot.isDragging ? 'shadow-md ring-1 ring-primary/50' : ''
          }`}
        >
          {task.priority && (
            <Badge 
              variant="outline" 
              className={`mb-2 text-[10px] uppercase font-semibold tracking-wider ${
                task.priority === 'High' ? 'text-destructive border-destructive/30 bg-destructive/10' :
                task.priority === 'Medium' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
              }`}
            >
              {task.priority}
            </Badge>
          )}
          
          <h4 className="text-sm font-medium leading-snug mb-3">
            {task.content}
          </h4>

          <div className="flex items-center justify-between text-muted-foreground mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-3">
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs">
                  <CalendarIcon className="w-3 h-3" />
                  <span>{task.dueDate}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs">
                <MessageSquare className="w-3 h-3" />
                <span>0</span>
              </div>
            </div>

            {task.assignees && task.assignees.length > 0 && (
              <div className="flex -space-x-2">
                {task.assignees.map((assignee) => (
                  <Avatar key={assignee.id} className="w-6 h-6 border-2 border-card">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {assignee.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}
