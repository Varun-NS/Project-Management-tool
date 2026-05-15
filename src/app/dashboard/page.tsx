import { getUserBoards } from '@/lib/actions/board'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const boards = await getUserBoards()

  if (boards.length === 0) {
    redirect('/')
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-8 py-8 space-y-8 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of all your boards and recent activity
            </p>
          </div>
        </div>

        {/* Boards Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Your Boards ({boards.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board: any) => (
              <Link
                key={board.id}
                href={`/?boardId=${board.id}`}
                className="group relative bg-card border border-border/50 rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {board.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(board.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}

            {/* Create new board card */}
            <Link
              href="/"
              className="group flex items-center justify-center gap-2 border border-dashed border-border/60 rounded-xl p-5 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 min-h-[88px]"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Create new board</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
