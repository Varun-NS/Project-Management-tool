export type Id = string;

// ── 12 List Colors (muted pastels, easy on the eyes) ──
export const LIST_COLORS = [
  { name: 'Slate',    value: '#7c8a9a' },
  { name: 'Rose',     value: '#c97878' },
  { name: 'Orange',   value: '#c48a5c' },
  { name: 'Amber',    value: '#b89a4f' },
  { name: 'Lime',     value: '#8aab5a' },
  { name: 'Emerald',  value: '#5a9e7e' },
  { name: 'Teal',     value: '#4f9e96' },
  { name: 'Sky',      value: '#5a8fad' },
  { name: 'Indigo',   value: '#7a7eb8' },
  { name: 'Violet',   value: '#9478b8' },
  { name: 'Fuchsia',  value: '#b06aad' },
  { name: 'Pink',     value: '#b87090' },
] as const

// ── 15 Category Colors ──
export const CATEGORY_COLORS = [
  { name: 'Red',       value: '#ef4444' },
  { name: 'Orange',    value: '#f97316' },
  { name: 'Amber',     value: '#f59e0b' },
  { name: 'Yellow',    value: '#eab308' },
  { name: 'Lime',      value: '#84cc16' },
  { name: 'Green',     value: '#22c55e' },
  { name: 'Emerald',   value: '#10b981' },
  { name: 'Teal',      value: '#14b8a6' },
  { name: 'Cyan',      value: '#06b6d4' },
  { name: 'Sky',       value: '#0ea5e9' },
  { name: 'Blue',      value: '#3b82f6' },
  { name: 'Indigo',    value: '#6366f1' },
  { name: 'Violet',    value: '#8b5cf6' },
  { name: 'Purple',    value: '#a855f7' },
  { name: 'Pink',      value: '#ec4899' },
] as const

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: Id;
  listId: Id;
  content: string;
  description?: string;
  assignees?: { id: string; name: string; avatar: string }[];
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  position: number;
  categories?: Category[];
  comments?: {
    id: string;
    content: string;
    createdAt: string;
    user: { name: string; avatar: string };
  }[];
}

export interface List {
  id: Id;
  title: string;
  tasks: Task[];
  position: number;
  color?: string;
}

export interface BoardMember {
  id: string;
  user_id: string;
  board_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export interface BoardInvite {
  id: string;
  board_id: string;
  email: string;
  role: 'editor' | 'viewer';
  invited_by: string;
  created_at: string;
}

export const initialData: List[] = [
  {
    id: 'list-1',
    title: 'To Do',
    position: 65536,
    tasks: [
      {
        id: 'task-1',
        listId: 'list-1',
        content: 'Research competitor features',
        priority: 'High',
        position: 65536,
        assignees: [{ id: 'u1', name: 'Varun', avatar: '' }]
      },
      {
        id: 'task-2',
        listId: 'list-1',
        content: 'Design system architecture',
        priority: 'Medium',
        position: 131072,
      },
    ],
  },
  {
    id: 'list-2',
    title: 'In Progress',
    position: 131072,
    tasks: [
      {
        id: 'task-3',
        listId: 'list-2',
        content: 'Setup Next.js project',
        priority: 'High',
        position: 65536,
        assignees: [{ id: 'u1', name: 'Varun', avatar: '' }]
      },
      {
        id: 'task-4',
        listId: 'list-2',
        content: 'Configure Supabase schema',
        priority: 'Medium',
        position: 131072,
      },
    ],
  },
  {
    id: 'list-3',
    title: 'In Review',
    position: 196608,
    tasks: [
      {
        id: 'task-5',
        listId: 'list-3',
        content: 'Create wireframes',
        priority: 'Low',
        position: 65536,
      },
    ],
  },
  {
    id: 'list-4',
    title: 'Done',
    position: 262144,
    tasks: [
      {
        id: 'task-6',
        listId: 'list-4',
        content: 'Project Kickoff',
        priority: 'Medium',
        position: 65536,
      },
    ],
  },
];
