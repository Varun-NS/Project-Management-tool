'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Helper to get client and check auth
async function getSupabase() {
  const supabase = await createClient()
  return supabase
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

  const { data: newBoard, error } = await supabase
    .from('boards')
    .insert({ title, created_by: user.id })
    .select()
    .single()

  if (error) throw new Error("Board creation error: " + error.message)
  
  revalidatePath('/')
  return newBoard
}

export async function getOrCreateDefaultBoard() {
  const boards = await getUserBoards()
  if (boards.length > 0) return boards[0]
  return await createBoard('My First Board')
}

export async function fetchBoardData(boardId: string) {
  const supabase = await getSupabase()

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
        assignees: card.assignees ? [
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

  return formattedLists
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

export async function updateListPositions(updates: { id: string, position: number }[]) {
  const supabase = await getSupabase()
  // Supabase doesn't have a bulk update RPC by default, so we'll do individual updates for simplicity,
  // or ideally use an RPC. For now, Promise.all is fine for small numbers.
  await Promise.all(
    updates.map(update => 
      supabase.from('lists').update({ position: update.position }).eq('id', update.id)
    )
  )
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

export async function deleteCard(cardId: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('cards').delete().eq('id', cardId)
  if (error) throw new Error(error.message)
}

export async function updateCardPositions(updates: { id: string, list_id: string, position: number }[]) {
  const supabase = await getSupabase()
  await Promise.all(
    updates.map(update => 
      supabase.from('cards').update({ list_id: update.list_id, position: update.position }).eq('id', update.id)
    )
  )
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
