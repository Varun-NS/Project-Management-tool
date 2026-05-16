-- =====================================================
-- Board sharing, members, pending invites, and RLS
-- Run this in the Supabase SQL Editor.
-- =====================================================

-- 1) Board members: every board owner is an owner member, invited users are
-- editors or viewers.
CREATE TABLE IF NOT EXISTS public.board_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'editor' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

ALTER TABLE public.board_members
  DROP CONSTRAINT IF EXISTS board_members_role_check;

UPDATE public.board_members
SET role = CASE
  WHEN role = 'member' THEN 'editor'
  WHEN role IN ('owner', 'editor', 'viewer') THEN role
  ELSE 'editor'
END;

ALTER TABLE public.board_members
  ADD CONSTRAINT board_members_role_check
  CHECK (role IN ('owner', 'editor', 'viewer'));

INSERT INTO public.board_members (board_id, user_id, role)
SELECT id, created_by, 'owner'
FROM public.boards
WHERE created_by IS NOT NULL
ON CONFLICT (board_id, user_id) DO UPDATE
SET role = 'owner';

-- 2) Pending invites: if the email does not exist yet in public.users, the app
-- saves a pending invite and auto-accepts it when that email signs up.
CREATE TABLE IF NOT EXISTS public.board_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'editor' NOT NULL,
  invited_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.board_invites
  DROP CONSTRAINT IF EXISTS board_invites_role_check;

UPDATE public.board_invites
SET email = LOWER(TRIM(email)),
    role = CASE
      WHEN role = 'member' THEN 'editor'
      WHEN role IN ('editor', 'viewer') THEN role
      ELSE 'editor'
    END;

ALTER TABLE public.board_invites
  ADD CONSTRAINT board_invites_role_check
  CHECK (role IN ('editor', 'viewer'));

CREATE UNIQUE INDEX IF NOT EXISTS board_invites_board_email_unique
ON public.board_invites (board_id, LOWER(email));

-- 3) Card assignees: cards can have multiple assigned board members. The old
-- cards.assigned_to column is kept as a compatibility fallback.
CREATE TABLE IF NOT EXISTS public.card_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id, user_id)
);

INSERT INTO public.card_assignees (card_id, user_id)
SELECT id, assigned_to
FROM public.cards
WHERE assigned_to IS NOT NULL
ON CONFLICT (card_id, user_id) DO NOTHING;

-- 4) Helper functions used by RLS. SECURITY DEFINER avoids recursive policies.
CREATE OR REPLACE FUNCTION public.is_board_member(board_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm
    WHERE bm.board_id = $1
      AND bm.user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_board_owner(board_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm
    WHERE bm.board_id = $1
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_edit_board(board_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm
    WHERE bm.board_id = $1
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'editor')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- App helper: update card positions safely through one permission-checked RPC.
CREATE OR REPLACE FUNCTION public.update_card_positions(card_updates jsonb)
RETURNS void AS $$
DECLARE
  item jsonb;
  current_board_id uuid;
  target_board_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(card_updates)
  LOOP
    SELECT l.board_id INTO current_board_id
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = (item->>'id')::uuid;

    SELECT board_id INTO target_board_id
    FROM public.lists
    WHERE id = (item->>'list_id')::uuid;

    IF current_board_id IS NULL OR target_board_id IS NULL THEN
      RAISE EXCEPTION 'Card or list not found';
    END IF;

    IF current_board_id <> target_board_id THEN
      RAISE EXCEPTION 'Cards can only move within the same board';
    END IF;

    IF NOT public.can_edit_board(current_board_id) THEN
      RAISE EXCEPTION 'You do not have permission to move cards on this board';
    END IF;

    UPDATE public.cards
    SET list_id = (item->>'list_id')::uuid,
        position = (item->>'position')::double precision
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.update_card_positions(jsonb) TO authenticated;

-- App helper: delete a card and its dependent rows safely. This avoids delete
-- failures when comments or assignees have their own RLS policies.
CREATE OR REPLACE FUNCTION public.delete_card_for_current_user(target_card_id uuid)
RETURNS void AS $$
DECLARE
  target_board_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT l.board_id INTO target_board_id
  FROM public.cards c
  JOIN public.lists l ON c.list_id = l.id
  WHERE c.id = target_card_id;

  IF target_board_id IS NULL THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  IF NOT public.can_edit_board(target_board_id) THEN
    RAISE EXCEPTION 'You do not have permission to delete cards on this board';
  END IF;

  DELETE FROM public.activity_log WHERE card_id = target_card_id;
  DELETE FROM public.card_assignees WHERE card_id = target_card_id;
  DELETE FROM public.comments WHERE card_id = target_card_id;
  DELETE FROM public.cards WHERE id = target_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.delete_card_for_current_user(uuid) TO authenticated;

-- 5) Trigger: add the creator as owner on every new board.
CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'owner';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_board_created ON public.boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_board();

-- App helper: create a board for the currently authenticated user. This keeps
-- board creation reliable even when RLS policies are being tightened.
CREATE OR REPLACE FUNCTION public.create_board_with_owner(board_title text)
RETURNS public.boards AS $$
DECLARE
  new_board public.boards;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.users (id, name, email, avatar_url)
  SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'User'),
    COALESCE(au.email, ''),
    au.raw_user_meta_data->>'avatar_url'
  FROM auth.users au
  WHERE au.id = current_user_id
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.boards (title, created_by)
  VALUES (NULLIF(TRIM(board_title), ''), current_user_id)
  RETURNING * INTO new_board;

  RETURN new_board;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.create_board_with_owner(text) TO authenticated;

-- 6) Trigger: create profile and auto-accept pending invites when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      avatar_url = EXCLUDED.avatar_url;

  INSERT INTO public.board_members (board_id, user_id, role)
  SELECT bi.board_id, NEW.id, bi.role
  FROM public.board_invites bi
  WHERE LOWER(bi.email) = LOWER(NEW.email)
  ON CONFLICT (board_id, user_id) DO UPDATE
  SET role = CASE
    WHEN public.board_members.role = 'owner' THEN 'owner'
    ELSE EXCLUDED.role
  END;

  DELETE FROM public.board_invites
  WHERE LOWER(email) = LOWER(NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7) Enable RLS.
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_assignees ENABLE ROW LEVEL SECURITY;

-- Drop old policies from the original schema and any previous sharing attempt.
DROP POLICY IF EXISTS "Users can view boards they are members of" ON public.boards;
DROP POLICY IF EXISTS "Users can insert boards" ON public.boards;
DROP POLICY IF EXISTS "Users can update boards they own" ON public.boards;
DROP POLICY IF EXISTS "Users can delete boards they own" ON public.boards;
DROP POLICY IF EXISTS "Board editors can update boards" ON public.boards;
DROP POLICY IF EXISTS "Board owners can delete boards" ON public.boards;

DROP POLICY IF EXISTS "Users can view members of their boards" ON public.board_members;
DROP POLICY IF EXISTS "Board owners can manage members" ON public.board_members;
DROP POLICY IF EXISTS "Board owners can insert members" ON public.board_members;
DROP POLICY IF EXISTS "Board owners can update members" ON public.board_members;
DROP POLICY IF EXISTS "Board owners can remove members" ON public.board_members;

DROP POLICY IF EXISTS "Board owners can manage invites" ON public.board_invites;
DROP POLICY IF EXISTS "Board members can view invites" ON public.board_invites;
DROP POLICY IF EXISTS "Board owners can create invites" ON public.board_invites;
DROP POLICY IF EXISTS "Board owners can update invites" ON public.board_invites;
DROP POLICY IF EXISTS "Board owners can delete invites" ON public.board_invites;

DROP POLICY IF EXISTS "Users can view lists of their boards" ON public.lists;
DROP POLICY IF EXISTS "Board members can insert lists" ON public.lists;
DROP POLICY IF EXISTS "Board members can update lists" ON public.lists;
DROP POLICY IF EXISTS "Board members can delete lists" ON public.lists;
DROP POLICY IF EXISTS "Board editors can insert lists" ON public.lists;
DROP POLICY IF EXISTS "Board editors can update lists" ON public.lists;
DROP POLICY IF EXISTS "Board editors can delete lists" ON public.lists;

DROP POLICY IF EXISTS "Users can view cards of their boards" ON public.cards;
DROP POLICY IF EXISTS "Board members can insert cards" ON public.cards;
DROP POLICY IF EXISTS "Board members can update cards" ON public.cards;
DROP POLICY IF EXISTS "Board members can delete cards" ON public.cards;
DROP POLICY IF EXISTS "Board editors can insert cards" ON public.cards;
DROP POLICY IF EXISTS "Board editors can update cards" ON public.cards;
DROP POLICY IF EXISTS "Board editors can delete cards" ON public.cards;

DROP POLICY IF EXISTS "Users can view card assignees of their boards" ON public.card_assignees;
DROP POLICY IF EXISTS "Board editors can insert card assignees" ON public.card_assignees;
DROP POLICY IF EXISTS "Board editors can update card assignees" ON public.card_assignees;
DROP POLICY IF EXISTS "Board editors can delete card assignees" ON public.card_assignees;

DROP POLICY IF EXISTS "Users can view comments of cards they can view" ON public.comments;
DROP POLICY IF EXISTS "Board members can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Board editors can insert comments" ON public.comments;
DROP POLICY IF EXISTS "Board editors can delete comments" ON public.comments;

-- Boards: all members can view; owners/editors can rename; owners can delete.
CREATE POLICY "Users can view boards they are members of"
ON public.boards FOR SELECT
USING (public.is_board_member(id));

CREATE POLICY "Users can insert boards"
ON public.boards FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Board editors can update boards"
ON public.boards FOR UPDATE
USING (public.can_edit_board(id))
WITH CHECK (public.can_edit_board(id));

CREATE POLICY "Board owners can delete boards"
ON public.boards FOR DELETE
USING (public.is_board_owner(id));

-- Members: board members can see the roster; only owners can add/remove people.
CREATE POLICY "Users can view members of their boards"
ON public.board_members FOR SELECT
USING (public.is_board_member(board_id));

CREATE POLICY "Board owners can insert members"
ON public.board_members FOR INSERT
WITH CHECK (public.is_board_owner(board_id));

CREATE POLICY "Board owners can update members"
ON public.board_members FOR UPDATE
USING (public.is_board_owner(board_id))
WITH CHECK (public.is_board_owner(board_id));

CREATE POLICY "Board owners can remove members"
ON public.board_members FOR DELETE
USING (public.is_board_owner(board_id));

-- Invites: members can see pending invites; only owners can create/cancel them.
CREATE POLICY "Board members can view invites"
ON public.board_invites FOR SELECT
USING (public.is_board_member(board_id));

CREATE POLICY "Board owners can create invites"
ON public.board_invites FOR INSERT
WITH CHECK (public.is_board_owner(board_id) AND invited_by = auth.uid());

CREATE POLICY "Board owners can update invites"
ON public.board_invites FOR UPDATE
USING (public.is_board_owner(board_id))
WITH CHECK (public.is_board_owner(board_id));

CREATE POLICY "Board owners can delete invites"
ON public.board_invites FOR DELETE
USING (public.is_board_owner(board_id));

-- Lists: viewers can read; owners/editors can collaborate.
CREATE POLICY "Users can view lists of their boards"
ON public.lists FOR SELECT
USING (public.is_board_member(board_id));

CREATE POLICY "Board editors can insert lists"
ON public.lists FOR INSERT
WITH CHECK (public.can_edit_board(board_id));

CREATE POLICY "Board editors can update lists"
ON public.lists FOR UPDATE
USING (public.can_edit_board(board_id))
WITH CHECK (public.can_edit_board(board_id));

CREATE POLICY "Board editors can delete lists"
ON public.lists FOR DELETE
USING (public.can_edit_board(board_id));

-- Cards: permissions are derived from the card's parent list.
CREATE POLICY "Users can view cards of their boards"
ON public.cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.is_board_member(l.board_id)
  )
);

CREATE POLICY "Board editors can insert cards"
ON public.cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Board editors can update cards"
ON public.cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.can_edit_board(l.board_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Board editors can delete cards"
ON public.cards FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.can_edit_board(l.board_id)
  )
);

-- Card assignees: permissions are derived from the assigned card's parent list.
CREATE POLICY "Users can view card assignees of their boards"
ON public.card_assignees FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.is_board_member(l.board_id)
  )
);

CREATE POLICY "Board editors can insert card assignees"
ON public.card_assignees FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    JOIN public.board_members bm ON bm.board_id = l.board_id AND bm.user_id = user_id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Board editors can update card assignees"
ON public.card_assignees FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    JOIN public.board_members bm ON bm.board_id = l.board_id AND bm.user_id = user_id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Board editors can delete card assignees"
ON public.card_assignees FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);

-- Comments: viewers can read; owners/editors can comment. Authors can edit/delete
-- their own comments while they still belong to the board.
CREATE POLICY "Users can view comments of cards they can view"
ON public.comments FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.is_board_member(l.board_id)
  )
);

CREATE POLICY "Board editors can insert comments"
ON public.comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Users can update their own comments"
ON public.comments FOR UPDATE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.comments FOR DELETE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);

CREATE POLICY "Board editors can delete comments"
ON public.comments FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.can_edit_board(l.board_id)
  )
);
