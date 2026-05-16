'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { Eye, Mail, Pencil, Trash2, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  cancelBoardInvite,
  getBoardMembers,
  inviteMemberByEmail,
  removeBoardMember,
} from '@/lib/actions/board'
import { BoardInvite, BoardMember } from '@/lib/mocks/board-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Role = 'editor' | 'viewer'

type BoardMembersProps = {
  boardId: string
  ownerId: string
  currentUser: { id: string; email?: string | null } | null
}

function getInitials(name?: string | null, email?: string | null) {
  const label = name || email || '?'
  return label
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
}

function roleBadge(role: BoardMember['role'] | BoardInvite['role']) {
  if (role === 'owner') return <Badge variant="default">Owner</Badge>
  if (role === 'viewer') return <Badge variant="outline">Viewer</Badge>
  return <Badge variant="secondary">Editor</Badge>
}

export function BoardMembers({ boardId, ownerId, currentUser }: BoardMembersProps) {
  const [open, setOpen] = useState(false)
  const [members, setMembers] = useState<BoardMember[]>([])
  const [invites, setInvites] = useState<BoardInvite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isOwner = currentUser?.id === ownerId
  const memberCount = members.length + invites.length

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === 'owner') return -1
      if (b.role === 'owner') return 1
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [members])

  const loadMembers = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getBoardMembers(boardId)
      setMembers(data.members as BoardMember[])
      setInvites(data.invites as BoardInvite[])
    } catch (error: any) {
      toast.error(error.message || 'Failed to load board members')
    } finally {
      setIsLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    if (open) loadMembers()
  }, [open, loadMembers])

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    startTransition(async () => {
      try {
        const result = await inviteMemberByEmail(boardId, trimmedEmail, role)
        setEmail('')
        await loadMembers()
        toast.success(
          result.type === 'added'
            ? `${result.email} can now access this board`
            : `Pending invite saved for ${result.email}`
        )
      } catch (error: any) {
        toast.error(error.message || 'Failed to invite member')
      }
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeBoardMember(boardId, userId)
        await loadMembers()
        toast.success('Member removed')
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove member')
      }
    })
  }

  function handleCancel(inviteId: string) {
    startTransition(async () => {
      try {
        await cancelBoardInvite(boardId, inviteId)
        await loadMembers()
        toast.success('Invite canceled')
      } catch (error: any) {
        toast.error(error.message || 'Failed to cancel invite')
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Users className="h-3.5 w-3.5" />
        Team
        {memberCount > 0 && (
          <span className="ml-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
            {memberCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={10} className="w-[380px] p-0">
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Board team</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Invite people to collaborate on this board.
            </p>
          </div>
          <Badge variant={isOwner ? 'default' : 'outline'}>{isOwner ? 'Owner' : 'Member'}</Badge>
        </div>

        {isOwner && (
          <>
            <Separator />
            <form onSubmit={handleInvite} className="space-y-3 p-4">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="h-9 pl-9 text-sm"
                    disabled={isPending}
                  />
                </div>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                  disabled={isPending}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={isPending || !email.trim()}>
                <UserPlus className="h-3.5 w-3.5" />
                Invite member
              </Button>
            </form>
          </>
        )}

        <Separator />
        <div className="max-h-[360px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading team...</div>
          ) : (
            <div className="space-y-1">
              {sortedMembers.map((member) => {
                const profile = member.user
                const name = profile?.name || profile?.email || 'Unknown user'
                const canRemove = isOwner && member.role !== 'owner' && member.user_id !== currentUser?.id

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                  >
                    <Avatar>
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
                      <AvatarFallback>{getInitials(profile?.name, profile?.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{name}</div>
                      <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                    </div>
                    {roleBadge(member.role)}
                    {canRemove && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(member.user_id)}
                        disabled={isPending}
                        aria-label={`Remove ${name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}

              {invites.length > 0 && (
                <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Pending invites
                </div>
              )}

              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
                >
                  <Avatar>
                    <AvatarFallback>{getInitials(null, invite.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{invite.email}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Pending</span>
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                      <span className="inline-flex items-center gap-1">
                        {invite.role === 'viewer' ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <Pencil className="h-3 w-3" />
                        )}
                        {invite.role}
                      </span>
                    </div>
                  </div>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleCancel(invite.id)}
                      disabled={isPending}
                      aria-label={`Cancel invite for ${invite.email}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}

              {!sortedMembers.length && !invites.length && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No members yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn('border-t border-border/50 px-4 py-3 text-xs text-muted-foreground', !isOwner && 'bg-muted/20')}>
          {isOwner
            ? 'Existing users are added immediately. New users get access after signing up with the invited email.'
            : 'Ask the board owner to invite or remove teammates.'}
        </div>
      </PopoverContent>
    </Popover>
  )
}
