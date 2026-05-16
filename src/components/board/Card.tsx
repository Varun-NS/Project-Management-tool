import { Draggable } from '@hello-pangea/dnd'
import { CalendarIcon, MessageSquare, Paperclip } from 'lucide-react'
import { Task } from '@/lib/mocks/board-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface CardProps {
  task: Task
  index: number
  onClick?: () => void
  isViewer?: boolean
}

export function Card({ task, index, onClick, isViewer }: CardProps) {
  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isViewer}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`rounded-xl p-3.5 group transition-[box-shadow,border-color] duration-200 ${
            isViewer ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
          } ${
            snapshot.isDragging
              ? 'shadow-xl shadow-black/15'
              : 'shadow-sm shadow-black/5 hover:shadow-md hover:shadow-black/10'
          }`}
          style={{
            ...provided.draggableProps.style,
            backgroundColor: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Category + Priority Badges (inline) */}
          {((task.categories && task.categories.length > 0) || task.priority) && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {task.categories?.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex max-w-full items-center break-words text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-all hover:opacity-80"
                  style={{ 
                    backgroundColor: `${cat.color}15`,
                    color: cat.color,
                    border: `1px solid ${cat.color}25`
                  }}
                >
                  {cat.name}
                </span>
              ))}
              {task.priority && (
                <span
                  className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    task.priority === 'High' ? 'text-red-600 border border-red-200 bg-red-50' :
                    task.priority === 'Medium' ? 'text-amber-600 border border-amber-200 bg-amber-50' :
                    'text-emerald-600 border border-emerald-200 bg-emerald-50'
                  }`}
                >
                  {task.priority}
                </span>
              )}
            </div>
          )}
          
          <h4 className="max-w-full whitespace-normal break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]" style={{ color: '#1a1a2e' }}>
            {task.content}
          </h4>

          {/* Footer: date, comments, assignees */}
          {(task.dueDate || (task.comments && task.comments.length > 0) || (task.assignees && task.assignees.length > 0)) && (
            <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <div className="flex items-center gap-3">
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                    <CalendarIcon className="w-3 h-3" />
                    <span>{task.dueDate}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs" style={{ color: '#6b7280' }}>
                  <MessageSquare className="w-3 h-3" />
                  <span>{task.comments?.length || 0}</span>
                </div>
              </div>

              {task.assignees && task.assignees.length > 0 && (
                <div className="flex -space-x-2">
                  {task.assignees.map((assignee) => (
                    <Avatar
                      key={assignee.id}
                      title={assignee.name}
                      className="w-6 h-6 border-2"
                      style={{ borderColor: '#ffffff' }}
                    >
                      <AvatarImage src={assignee.avatar} />
                      <AvatarFallback className="text-[10px]" style={{ backgroundColor: '#e8e0ff', color: '#6b46c1' }}>
                        {assignee.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
