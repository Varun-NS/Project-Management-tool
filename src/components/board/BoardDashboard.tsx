import React, { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { List, Category } from '@/lib/mocks/board-data'
import { ScrollArea } from '@/components/ui/scroll-area'

interface BoardDashboardProps {
  isOpen: boolean
  onClose: () => void
  lists: List[]
  boardCategories: Category[]
  boardMembers: any[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function BoardDashboard({ isOpen, onClose, lists, boardCategories, boardMembers }: BoardDashboardProps) {
  // Aggregate data for Tasks per Member
  const tasksPerMember = useMemo(() => {
    const counts: Record<string, number> = {}
    let unassignedCount = 0

    lists.forEach(list => {
      list.tasks.forEach(task => {
        if (!task.assignees || task.assignees.length === 0) {
          unassignedCount++
        } else {
          task.assignees.forEach(assignee => {
            counts[assignee.name] = (counts[assignee.name] || 0) + 1
          })
        }
      })
    })

    const data = Object.keys(counts).map(name => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count)
    if (unassignedCount > 0) {
      data.push({ name: 'Unassigned', count: unassignedCount })
    }
    return data
  }, [lists])

  // Aggregate data for Tasks per Category
  const tasksPerCategory = useMemo(() => {
    const counts: Record<string, number> = {}
    let noLabelCount = 0

    lists.forEach(list => {
      list.tasks.forEach(task => {
        if (!task.categories || task.categories.length === 0) {
          noLabelCount++
        } else {
          task.categories.forEach(cat => {
            counts[cat.name] = (counts[cat.name] || 0) + 1
          })
        }
      })
    })

    const data = Object.keys(counts).map(name => {
      const category = boardCategories.find(c => c.name === name)
      return { 
        name, 
        count: counts[name],
        color: category ? category.color : COLORS[0]
      }
    }).sort((a, b) => b.count - a.count)

    if (noLabelCount > 0) {
      data.push({ name: 'No Label', count: noLabelCount, color: '#94a3b8' })
    }
    return data
  }, [lists, boardCategories])

  // Aggregate data for Tasks per List
  const tasksPerList = useMemo(() => {
    return lists.map(list => ({
      name: list.title,
      count: list.tasks.length,
      color: list.color || COLORS[0] // Fallback color
    }))
  }, [lists])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 border border-border shadow-md rounded-lg p-3 text-sm">
          <p className="font-semibold mb-1 text-foreground">{label}</p>
          <p className="text-muted-foreground">
            Cards: <span className="font-medium text-foreground">{payload[0].value}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] md:max-w-[1000px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 md:px-8 border-b border-border/40 shrink-0">
          <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Board Analytics Dashboard
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Visualize your board's activity and distribution.</p>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 md:p-8 space-y-12">
            
            {/* Chart 1: Tasks by List */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium tracking-tight">Cards per List</h3>
              <div className="h-[300px] w-full bg-muted/20 border border-border/30 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tasksPerList} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} height={30} tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {tasksPerList.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Chart 2: Tasks by Member */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium tracking-tight">Cards per Member</h3>
                <div className="h-[300px] w-full bg-muted/20 border border-border/30 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksPerMember} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} height={30} tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {tasksPerMember.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Unassigned' ? '#94a3b8' : COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Tasks by Category */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium tracking-tight">Cards per Label</h3>
                <div className="h-[300px] w-full bg-muted/20 border border-border/30 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksPerCategory} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} height={30} tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                        {tasksPerCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
