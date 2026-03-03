import type { Project, Task, Tag, Conversation } from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const projects = {
  list: () => request<Project[]>("/projects"),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; color?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Project, "name" | "description" | "color">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
};

// Tasks
export const tasks = {
  listAll: () => request<Task[]>("/tasks"),
  dueSoon: () => request<Task[]>("/tasks/due-soon"),
  list: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks`),
  create: (projectId: string, data: { title: string; priority?: string; dueDate?: string; description?: string }) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Task, "title" | "description" | "priority" | "dueDate">>) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  toggleComplete: (id: string) =>
    request<Task>(`/tasks/${id}/complete`, { method: "PATCH" }),
  reorder: (items: { id: string; sortOrder: number }[]) =>
    request<void>("/tasks/reorder", { method: "PATCH", body: JSON.stringify({ items }) }),
  delete: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  addTag: (taskId: string, tagId: string) =>
    request<void>(`/tasks/${taskId}/tags`, { method: "POST", body: JSON.stringify({ tagId }) }),
  removeTag: (taskId: string, tagId: string) =>
    request<void>(`/tasks/${taskId}/tags/${tagId}`, { method: "DELETE" }),
  listFiltered: (params: {
    projectId?: string;
    completed?: boolean;
    priority?: string;
    dueBefore?: string;
    dueAfter?: string;
    sortBy?: string;
    sortOrder?: string;
    tagId?: string;
  }) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) searchParams.set(key, String(value));
    }
    return request<Task[]>(`/tasks?${searchParams.toString()}`);
  },
  bulkComplete: (taskIds: string[], completed: boolean) =>
    request<{ count: number }>("/tasks/bulk-complete", {
      method: "PATCH",
      body: JSON.stringify({ taskIds, completed }),
    }),
  bulkDelete: (taskIds: string[]) =>
    request<{ count: number }>("/tasks/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ taskIds }),
    }),
  bulkMove: (taskIds: string[], projectId: string) =>
    request<{ count: number }>("/tasks/bulk-move", {
      method: "PATCH",
      body: JSON.stringify({ taskIds, projectId }),
    }),
};

// Tags
export const tags = {
  list: () => request<Tag[]>("/tags"),
  create: (data: { name: string; color?: string }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; color?: string }) =>
    request<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: "DELETE" }),
};

// Chat
export const chat = {
  conversations: () => request<Conversation[]>("/conversations"),
  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
};
