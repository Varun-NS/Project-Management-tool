'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type BoardRole = 'owner' | 'editor' | 'viewer'
type InviteRole = Exclude<BoardRole, 'owner'>

// Helper to get client and check auth
async function getSupabase() {
  const supabase = await createClient()
  return supabase
}

function normalizeInviteRole(role: string): InviteRole {
  if (role === 'viewer') return 'viewer'
  return 'editor'
}

export async function getUserBoards() {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  // Fetch boards where user is creator OR member (RLS handles the filtering automatically)
  const { data: boards, error } = await supabase
    .from('boards')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error("Boards fetch error: " + error.message)
  return boards || []
}

export async function createBoard(title: string) {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const trimmedTitle = title.trim() || 'Untitled Board'

  const { data: rpcBoard, error: rpcError } = await supabase
    .rpc('create_board_with_owner', { board_title: trimmedTitle })

  if (!rpcError && rpcBoard) {
    revalidatePath('/')
    return Array.isArray(rpcBoard) ? rpcBoard[0] : rpcBoard
  }

  const { data: newBoard, error } = await supabase
    .from('boards')
    .insert({ title: trimmedTitle, created_by: user.id })
    .select()
    .single()

  if (error) {
    throw new Error("Board creation error: " + error.message)
  }
  
  revalidatePath('/')
  return newBoard
}

export async function getOrCreateDefaultBoard() {
  const boards = await getUserBoards()
  if (boards.length > 0) return boards[0]
  return await createBoard('My First Board')
}

export async function deleteBoard(boardId: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('boards').delete().eq('id', boardId)
  if (error) throw new Error(error.message)
  revalidatePath('/')
}

export async function renameBoard(boardId: string, title: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('boards').update({ title }).eq('id', boardId)
  if (error) throw new Error(error.message)
  revalidatePath('/')
}

export async function fetchBoardData(boardId: string) {
  const supabase = await getSupabase()

  // Fetch board for category library
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('categories')
    .eq('id', boardId)
    .single()

  // Fetch lists
  const { data: lists, error: listsError } = await supabase
    .from('lists')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true })

  if (listsError) throw new Error("Lists fetch error: " + listsError.message)

  // Fetch cards
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select(`
      *,
      assignees:users!assigned_to(id, name, avatar_url),
      card_assignees(user:users(id, name, avatar_url)),
      comments(id, comment, created_at, user:users(id, name, avatar_url))
    `)
    .in('list_id', lists.map(l => l.id))
    .order('position', { ascending: true })

  if (cardsError) throw new Error("Cards fetch error: " + cardsError.message)

  // Format into the shape expected by the frontend
  const formattedLists = lists.map((list) => ({
    id: list.id,
    title: list.title,
    position: list.position,
    color: list.color || undefined,
    tasks: cards
      .filter((card) => card.list_id === list.id)
      .map((card) => ({
        id: card.id,
        listId: card.list_id,
        content: card.title,
        description: card.description || '',
        dueDate: card.due_date ? new Date(card.due_date).toLocaleDateString() : undefined,
        priority: card.priority,
        position: card.position,
        categories: card.categories || [],
        assignees: card.card_assignees?.length
          ? card.card_assignees
              .map((assignment: any) => assignment.user)
              .filter(Boolean)
              .map((user: any) => ({
                id: user.id,
                name: user.name,
                avatar: user.avatar_url || ''
              }))
          : card.assignees ? [
              {
                id: card.assignees.id,
                name: card.assignees.name,
                avatar: card.assignees.avatar_url || ''
              }
            ] : [],
        comments: (card.comments || []).map((c: any) => ({
          id: c.id,
          content: c.comment,
          createdAt: c.created_at,
          user: { name: c.user?.name || 'Unknown User', avatar: c.user?.avatar_url || '' }
        })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })),
  }))

  return { lists: formattedLists, boardCategories: board?.categories || [] }
}

export async function createList(boardId: string, title: string, position: number) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('lists')
    .insert({ board_id: boardId, title, position })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteList(listId: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw new Error(error.message)
}

export async function renameList(listId: string, title: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('lists').update({ title }).eq('id', listId)
  if (error) throw new Error(error.message)
}

export async function updateListColor(listId: string, color: string | null) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('lists').update({ color }).eq('id', listId)
  if (error) throw new Error(error.message)
}

export async function updateBoardCategories(boardId: string, categories: any[]) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('boards').update({ categories }).eq('id', boardId)
  if (error) throw new Error(error.message)
}

export async function updateListPositions(updates: { id: string, position: number }[]) {
  const supabase = await getSupabase()
  // Supabase doesn't have a bulk update RPC by default, so we'll do individual updates for simplicity,
  // or ideally use an RPC. For now, Promise.all is fine for small numbers.
  const results = await Promise.all(
    updates.map(update => 
      supabase.from('lists').update({ position: update.position }).eq('id', update.id)
    )
  )
  const error = results.find(result => result.error)?.error
  if (error) throw new Error(error.message)
}

export async function createCard(listId: string, title: string, position: number) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('cards')
    .insert({ list_id: listId, title, position })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateCardDetails(cardId: string, updates: any) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('cards').update(updates).eq('id', cardId)
  if (error) throw new Error(error.message)
}

export async function updateCardAssignees(cardId: string, userIds: string[]) {
  const supabase = await getSupabase()
  const uniqueUserIds = Array.from(new Set(userIds))

  const { error: deleteError } = await supabase
    .from('card_assignees')
    .delete()
    .eq('card_id', cardId)

  if (deleteError) throw new Error(deleteError.message)

  if (uniqueUserIds.length > 0) {
    const { error: insertError } = await supabase
      .from('card_assignees')
      .insert(uniqueUserIds.map((userId) => ({ card_id: cardId, user_id: userId })))

    if (insertError) throw new Error(insertError.message)
  }

  // Keep the old single-assignee column populated for older code/data views.
  const { error: legacyError } = await supabase
    .from('cards')
    .update({ assigned_to: uniqueUserIds[0] || null })
    .eq('id', cardId)

  if (legacyError) throw new Error(legacyError.message)
}

export async function deleteCard(cardId: string) {
  const supabase = await getSupabase()

  const { error: rpcError } = await supabase.rpc('delete_card_for_current_user', {
    target_card_id: cardId,
  })

  if (!rpcError) return
  if (rpcError.code !== 'PGRST202') throw new Error(rpcError.message)

  const { error: activityError } = await supabase.from('activity_log').delete().eq('card_id', cardId)
  if (activityError) throw new Error(activityError.message)

  const { error: assigneesError } = await supabase.from('card_assignees').delete().eq('card_id', cardId)
  if (assigneesError) throw new Error(assigneesError.message)

  const { error: commentsError } = await supabase.from('comments').delete().eq('card_id', cardId)
  if (commentsError) throw new Error(commentsError.message)

  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw new Error(error.message)
}

export async function updateCardPositions(updates: { id: string, list_id: string, position: number }[]) {
  const supabase = await getSupabase()

  const { error: rpcError } = await supabase.rpc('update_card_positions', {
    card_updates: updates,
  })

  if (!rpcError) return
  if (rpcError.code !== 'PGRST202') throw new Error(rpcError.message)

  const results = await Promise.all(
    updates.map(update => 
      supabase.from('cards').update({ list_id: update.list_id, position: update.position }).eq('id', update.id)
    )
  )
  const error = results.find(result => result.error)?.error
  if (error) throw new Error(error.message)
}

export async function createComment(cardId: string, comment: string) {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('comments')
    .insert({ card_id: cardId, user_id: user.id, comment })
    .select('*, user:users(id, name, avatar_url)')
    .single()

  if (error) throw new Error(error.message)
  return {
    id: data.id,
    content: data.comment,
    createdAt: data.created_at,
    user: { name: data.user?.name || 'Unknown User', avatar: data.user?.avatar_url || '' }
  }
}

// ── Board Members & Invites ──────────────────────────────────────

export async function getCurrentUser() {
  const supabase = await getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { id: user.id, email: user.email }
}

export async function getCurrentUserProfile() {
  const supabase = await getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, email, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    name: profile?.name || user.user_metadata?.full_name || user.email || 'User',
    email: profile?.email || user.email || '',
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
  }
}

export async function getBoardMembers(boardId: string) {
  const supabase = await getSupabase()

  // Fetch members with their user profiles
  const { data: members, error: membersError } = await supabase
    .from('board_members')
    .select('*, user:users(id, name, email, avatar_url)')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })

  if (membersError) throw new Error('Failed to fetch members: ' + membersError.message)

  // Fetch pending invites
  const { data: invites, error: invitesError } = await supabase
    .from('board_invites')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })

  if (invitesError) throw new Error('Failed to fetch invites: ' + invitesError.message)

  return {
    members: members || [],
    invites: invites || [],
  }
}

export async function inviteMemberByEmail(boardId: string, email: string, role: string = 'editor') {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Verify the inviter owns the board
  const { data: board } = await supabase
    .from('boards')
    .select('created_by')
    .eq('id', boardId)
    .single()

  if (!board || board.created_by !== user.id) {
    throw new Error('Only the board owner can invite members')
  }

  const normalizedEmail = email.toLowerCase().trim()
  const inviteRole = normalizeInviteRole(role)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address')
  }

  // Don't invite yourself
  if (normalizedEmail === user.email?.toLowerCase()) {
    throw new Error("You can't invite yourself")
  }

  // Check if user exists in the system
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (existingUser) {
    // Check if already a member
    const { data: existingMember } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', boardId)
      .eq('user_id', existingUser.id)
      .maybeSingle()

    if (existingMember) {
      throw new Error('This user is already a member of this board')
    }

    // Add directly as member
    const { error } = await supabase
      .from('board_members')
      .insert({ board_id: boardId, user_id: existingUser.id, role: inviteRole })

    if (error) throw new Error('Failed to add member: ' + error.message)

    revalidatePath('/')
    return { type: 'added' as const, email: normalizedEmail }
  } else {
    // Check if invite already exists
    const { data: existingInvite } = await supabase
      .from('board_invites')
      .select('id')
      .eq('board_id', boardId)
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existingInvite) {
      throw new Error('An invite has already been sent to this email')
    }

    // Create a pending invite
    const { error } = await supabase
      .from('board_invites')
      .insert({ board_id: boardId, email: normalizedEmail, role: inviteRole, invited_by: user.id })

    if (error) throw new Error('Failed to create invite: ' + error.message)

    revalidatePath('/')
    return { type: 'invited' as const, email: normalizedEmail }
  }
}

export async function removeBoardMember(boardId: string, userId: string) {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Don't allow removing yourself as owner
  if (userId === user.id) {
    throw new Error("You can't remove yourself from the board")
  }

  const { data: board } = await supabase
    .from('boards')
    .select('created_by')
    .eq('id', boardId)
    .single()

  if (!board || board.created_by !== user.id) {
    throw new Error('Only the board owner can remove members')
  }

  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)

  if (error) throw new Error('Failed to remove member: ' + error.message)
  revalidatePath('/')
}

export async function cancelBoardInvite(boardId: string, inviteId: string) {
  const supabase = await getSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data: board } = await supabase
    .from('boards')
    .select('created_by')
    .eq('id', boardId)
    .single()

  if (!board || board.created_by !== user.id) {
    throw new Error('Only the board owner can cancel invites')
  }

  const { error } = await supabase
    .from('board_invites')
    .delete()
    .eq('id', inviteId)
    .eq('board_id', boardId)

  if (error) throw new Error('Failed to cancel invite: ' + error.message)
  revalidatePath('/')
}
