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
  _count?: { tasks: number };
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
  project?: { id: string; name: string; color: string | null };
}

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls: string | null;
  toolCallId: string | null;
  createdAt: string;
  conversationId: string;
}
