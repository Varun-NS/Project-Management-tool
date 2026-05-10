export type Id = string;

export interface Task {
  id: Id;
  listId: Id;
  content: string;
  description?: string;
  assignees?: { id: string; name: string; avatar: string }[];
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
  position: number;
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
