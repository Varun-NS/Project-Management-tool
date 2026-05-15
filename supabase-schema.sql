-- Users table is handled by Supabase Auth (auth.users)
-- We'll create a public users table that syncs with auth.users if needed, or just use auth.users.
-- For simplicity and better relations, let's create a public.users profile table.

CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Boards Table
CREATE TABLE public.boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board Members (for sharing boards)
CREATE TABLE public.board_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- Lists Table
CREATE TABLE public.lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position REAL NOT NULL, -- using REAL or float to allow inserting between easily
  color TEXT, -- hex color string for list background (e.g. '#f43f5e')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cards Table
CREATE TABLE public.cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
  status TEXT DEFAULT 'Todo',
  position REAL NOT NULL,
  categories JSONB DEFAULT '[]', -- array of {id, name, color} objects
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments Table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log Table
CREATE TABLE public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g. 'created', 'moved', 'updated'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Helper Function to Break Infinite Recursion
CREATE OR REPLACE FUNCTION public.is_board_member(board_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members bm WHERE bm.board_id = $1 AND bm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow users to view their own profile and others in the same boards
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Boards Policies
CREATE POLICY "Users can view boards they are members of" ON public.boards FOR SELECT USING (
  auth.uid() = created_by OR public.is_board_member(id)
);
CREATE POLICY "Users can insert boards" ON public.boards FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update boards they own" ON public.boards FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete boards they own" ON public.boards FOR DELETE USING (auth.uid() = created_by);

-- Board Members Policies
CREATE OR REPLACE FUNCTION public.get_my_boards()
RETURNS SETOF uuid AS $$
  SELECT board_id FROM public.board_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view members of their boards" ON public.board_members FOR SELECT USING (
  board_id IN (SELECT public.get_my_boards())
);
CREATE POLICY "Board owners can manage members" ON public.board_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND created_by = auth.uid())
);

-- Lists Policies
CREATE POLICY "Users can view lists of their boards" ON public.lists FOR SELECT USING (
  public.is_board_member(board_id)
);
CREATE POLICY "Board members can insert lists" ON public.lists FOR INSERT WITH CHECK (
  public.is_board_member(board_id)
);
CREATE POLICY "Board members can update lists" ON public.lists FOR UPDATE USING (
  public.is_board_member(board_id)
);
CREATE POLICY "Board members can delete lists" ON public.lists FOR DELETE USING (
  public.is_board_member(board_id)
);

-- Cards Policies
CREATE POLICY "Users can view cards of their boards" ON public.cards FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.is_board_member(l.board_id)
  )
);
CREATE POLICY "Board members can insert cards" ON public.cards FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.is_board_member(l.board_id)
  )
);
CREATE POLICY "Board members can update cards" ON public.cards FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.is_board_member(l.board_id)
  )
);
CREATE POLICY "Board members can delete cards" ON public.cards FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = list_id AND public.is_board_member(l.board_id)
  )
);

-- Comments Policies
CREATE POLICY "Users can view comments of cards they can view" ON public.comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.is_board_member(l.board_id)
  )
);
CREATE POLICY "Board members can insert comments" ON public.comments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cards c
    JOIN public.lists l ON c.list_id = l.id
    WHERE c.id = card_id AND public.is_board_member(l.board_id)
  )
);
CREATE POLICY "Users can update their own comments" ON public.comments FOR UPDATE USING (
  auth.uid() = user_id
);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (
  auth.uid() = user_id
);

-- Functions and Triggers
-- Function to automatically add board creator as a member
CREATE OR REPLACE FUNCTION public.handle_new_board()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_board();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
