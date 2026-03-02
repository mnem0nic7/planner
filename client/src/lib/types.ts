export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
  tasks?: Task[];
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface TaskTag {
  taskId: string;
  tagId: string;
  tag: Tag;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  tags: TaskTag[];
}
