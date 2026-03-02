import type { Project, Task, Tag } from "./types";

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
};

// Tags
export const tags = {
  list: () => request<Tag[]>("/tags"),
  create: (data: { name: string; color?: string }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: "DELETE" }),
};
