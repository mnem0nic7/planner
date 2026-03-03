# Tags CRUD UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Tags management page with CRUD + usage counts, make sidebar tags clickable for task filtering, and add a tag-filtered task view.

**Architecture:** Server-first approach — add tag usage counts to GET /api/tags and tagId filter to GET /api/tasks, then build the two new pages (TagsPage, TagTasks) and wire up navigation. Sidebar gets a "Tags" nav link and clickable tag badges.

**Tech Stack:** React (Vite), Express, Prisma/SQLite, Tailwind CSS, Vitest + Supertest

---

### Task 1: Server — Add task counts to GET /api/tags

**Files:**
- Modify: `server/src/routes/tags.ts:9-13`
- Modify: `client/src/lib/types.ts:14-18`
- Test: `server/src/__tests__/tags.test.ts`

**Step 1: Write the failing test**

Add to `server/src/__tests__/tags.test.ts` inside the `GET /api/tags` describe block:

```typescript
it("includes task count per tag", async () => {
  const tag = await prisma.tag.create({ data: { name: `counted-${Date.now()}` } });
  const project = await prisma.project.create({ data: { name: `P-${Date.now()}` } });
  const task = await prisma.task.create({
    data: { title: "T", projectId: project.id, sortOrder: 0 },
  });
  await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } });

  const res = await request(app).get("/api/tags");
  expect(res.status).toBe(200);
  const found = res.body.find((t: { id: string }) => t.id === tag.id);
  expect(found._count.tasks).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/tags.test.ts`
Expected: FAIL — `_count` is undefined on tag objects

**Step 3: Update GET /api/tags to include task counts**

In `server/src/routes/tags.ts`, replace lines 10-12:

```typescript
// Before:
const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

// After:
const tags = await prisma.tag.findMany({
  orderBy: { name: "asc" },
  include: { _count: { select: { tasks: true } } },
});
```

**Step 4: Update the Tag type to include optional _count**

In `client/src/lib/types.ts`, update the Tag interface (lines 14-18):

```typescript
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  _count?: { tasks: number };
}
```

**Step 5: Run tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add server/src/routes/tags.ts server/src/__tests__/tags.test.ts client/src/lib/types.ts
git commit -m "feat: include task usage counts in GET /api/tags response"
```

---

### Task 2: Server — Add tagId filter to GET /api/tasks

**Files:**
- Modify: `server/src/routes/tasks.ts:23-82` (GET /api/tasks handler)
- Test: `server/src/__tests__/tasks.test.ts`

**Step 1: Write the failing test**

Add to `server/src/__tests__/tasks.test.ts` inside the `GET /api/tasks (filtering & sorting)` describe block:

```typescript
it("filters by tagId", async () => {
  const tag = await prisma.tag.create({ data: { name: `filter-tag-${Date.now()}` } });
  // taskIds from beforeEach are scoped, so create fresh tasks
  const project = await prisma.project.create({ data: { name: `tagfilter-${Date.now()}` } });
  const t1 = await prisma.task.create({ data: { title: "Tagged", projectId: project.id, sortOrder: 0 } });
  await prisma.task.create({ data: { title: "Untagged", projectId: project.id, sortOrder: 1 } });
  await prisma.taskTag.create({ data: { taskId: t1.id, tagId: tag.id } });

  const res = await request(app).get(`/api/tasks?tagId=${tag.id}`);
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(1);
  expect(res.body[0].title).toBe("Tagged");
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL — tagId param ignored, returns all tasks

**Step 3: Add tagId filter**

In `server/src/routes/tasks.ts`, inside the GET /api/tasks handler, add after the priority filter block (after line 41) and before the dueBefore/dueAfter block:

```typescript
  // Filter: tagId (tasks that have this tag via TaskTag join)
  if (req.query.tagId && typeof req.query.tagId === "string") {
    where.tags = { some: { tagId: req.query.tagId } };
  }
```

**Step 4: Run tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add server/src/routes/tasks.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add tagId filter to GET /api/tasks"
```

---

### Task 3: Server — Add tagId to list_tasks AI tool

**Files:**
- Modify: `server/src/ai/tools.ts:115-147` (list_tasks properties)
- Modify: `server/src/ai/toolExecutor.ts:116-149` (list_tasks case)

**Step 1: Write the failing test**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("list_tasks AI tool (tagId filter)", () => {
  it("filters by tagId via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const tag = await prisma.tag.create({ data: { name: `aitag-${Date.now()}` } });
    const project = await prisma.project.create({ data: { name: `aitagproj-${Date.now()}` } });
    const t1 = await prisma.task.create({ data: { title: "WithTag", projectId: project.id, sortOrder: 0 } });
    await prisma.task.create({ data: { title: "NoTag", projectId: project.id, sortOrder: 1 } });
    await prisma.taskTag.create({ data: { taskId: t1.id, tagId: tag.id } });

    const result = await executeTool("list_tasks", { tagId: tag.id }) as unknown[];
    expect(result.length).toBe(1);
    expect((result[0] as { title: string }).title).toBe("WithTag");
  });
});
```

**Step 2: Run test to verify it fails**

**Step 3: Add tagId to tool definition**

In `server/src/ai/tools.ts`, add inside the list_tasks properties object (after the `sortOrder` property, before the closing `}`):

```typescript
          tagId: {
            type: "string",
            description: "Filter to tasks that have this specific tag.",
          },
```

**Step 4: Add tagId to executor**

In `server/src/ai/toolExecutor.ts`, in the list_tasks case, add after the priority filter (after line 120):

```typescript
      if (args.tagId && typeof args.tagId === "string") {
        where.tags = { some: { tagId: args.tagId as string } };
      }
```

**Step 5: Run tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add server/src/ai/tools.ts server/src/ai/toolExecutor.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add tagId filter to list_tasks AI tool"
```

---

### Task 4: Client — Add tagId to API wrapper

**Files:**
- Modify: `client/src/lib/api.ts:47-61` (listFiltered params)

**Step 1: Add tagId to listFiltered params**

In `client/src/lib/api.ts`, update the `listFiltered` method's params type (line 47-55) to include `tagId`:

```typescript
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
```

**Step 2: Build to verify**

Run: `npm run build --workspace=client`
Expected: Compiles cleanly

**Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat: add tagId param to tasks.listFiltered API method"
```

---

### Task 5: Client — Navigation wiring (App.tsx, Layout.tsx, Sidebar.tsx)

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Layout.tsx`
- Modify: `client/src/components/Sidebar.tsx`

**Step 1: Update App.tsx**

Expand the View type to include the new views and add `activeTagId` state:

```typescript
type View = "dashboard" | "project" | "all-tasks" | "due-soon" | "tags" | "tag-tasks";
```

Add state:

```typescript
const [activeTagId, setActiveTagId] = useState<string | null>(null);
```

Add handler:

```typescript
const handleSelectTag = (tagId: string) => {
  setActiveTagId(tagId);
  setActiveProjectId(null);
  setView("tag-tasks");
};
```

Update `handleSelectView` to accept the new views:

```typescript
const handleSelectView = (v: "dashboard" | "all-tasks" | "due-soon" | "tags") => {
  setActiveProjectId(null);
  setActiveTagId(null);
  setView(v);
};
```

Pass new props to Layout:

```tsx
<Layout
  activeProjectId={activeProjectId}
  activeView={view}
  activeTagId={activeTagId}
  onSelectProject={handleSelectProject}
  onSelectView={handleSelectView}
  onSelectTag={handleSelectTag}
  chatOpen={chatOpen}
  refreshKey={refreshKey}
>
```

Add view rendering (inside Layout children):

```tsx
{view === "tags" && <TagsPage key={refreshKey} />}
{view === "tag-tasks" && activeTagId && <TagTasks key={refreshKey} tagId={activeTagId} />}
```

Import the new pages at the top:

```typescript
import { TagsPage } from "./pages/TagsPage";
import { TagTasks } from "./pages/TagTasks";
```

**Step 2: Update Layout.tsx**

Update the LayoutProps interface to add new props:

```typescript
interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: string;
  activeTagId?: string | null;
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon" | "tags") => void;
  onSelectTag: (tagId: string) => void;
  chatOpen?: boolean;
  refreshKey?: number;
}
```

Destructure and pass through to Sidebar:

```tsx
export function Layout({ children, activeProjectId, activeView, activeTagId, onSelectProject, onSelectView, onSelectTag, chatOpen, refreshKey }: LayoutProps) {
```

Add a `handleSelectTag` that also closes mobile sidebar:

```typescript
const handleSelectTag = (tagId: string) => {
  onSelectTag(tagId);
  setSidebarOpen(false);
};
```

Pass to Sidebar:

```tsx
<Sidebar
  activeProjectId={activeProjectId}
  activeView={activeView}
  activeTagId={activeTagId}
  onSelectProject={handleSelectProject}
  onSelectView={handleSelectView}
  onSelectTag={handleSelectTag}
  refreshKey={refreshKey}
/>
```

**Step 3: Update Sidebar.tsx**

Update SidebarProps:

```typescript
interface SidebarProps {
  activeProjectId: string | null;
  activeView: string;
  activeTagId?: string | null;
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon" | "tags") => void;
  onSelectTag: (tagId: string) => void;
  refreshKey?: number;
}
```

Destructure:

```typescript
export function Sidebar({ activeProjectId, activeView, activeTagId, onSelectProject, onSelectView, onSelectTag, refreshKey }: SidebarProps) {
```

Add "Tags" nav button after "Due Soon" (after line 52):

```tsx
<button
  onClick={() => onSelectView("tags")}
  className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
    activeView === "tags" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
  }`}
>
  Tags
</button>
```

Make sidebar tag badges clickable — change `<span>` to `<button>` (replace lines 78-89):

```tsx
{tagList.map((tag) => (
  <button
    key={tag.id}
    onClick={() => onSelectTag(tag.id)}
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${
      activeTagId === tag.id ? "ring-2 ring-blue-400" : "hover:opacity-80"
    }`}
    style={{
      backgroundColor: tag.color ? `${tag.color}20` : "#e5e7eb",
      color: tag.color || "#374151",
    }}
  >
    {tag.name}
  </button>
))}
```

**Step 4: Create placeholder pages** (so TypeScript compiles)

Create `client/src/pages/TagsPage.tsx`:

```tsx
export function TagsPage() {
  return <div className="p-8"><h2 className="text-2xl font-bold text-gray-900">Tags</h2></div>;
}
```

Create `client/src/pages/TagTasks.tsx`:

```tsx
export function TagTasks({ tagId }: { tagId: string }) {
  return <div className="p-8"><h2 className="text-2xl font-bold text-gray-900">Tag Tasks: {tagId}</h2></div>;
}
```

**Step 5: Build to verify**

Run: `npm run build --workspace=client`
Expected: Compiles cleanly

**Step 6: Commit**

```bash
git add client/src/App.tsx client/src/components/Layout.tsx client/src/components/Sidebar.tsx client/src/pages/TagsPage.tsx client/src/pages/TagTasks.tsx
git commit -m "feat: add tags navigation, clickable sidebar tags, placeholder pages"
```

---

### Task 6: Client — TagsPage with full CRUD

**Files:**
- Modify: `client/src/pages/TagsPage.tsx` (replace placeholder with full implementation)

**Step 1: Implement TagsPage**

Replace the placeholder in `client/src/pages/TagsPage.tsx` with the full implementation:

```tsx
import { useState, useEffect } from "react";
import { tags as tagsApi } from "../lib/api";
import type { Tag } from "../lib/types";

const DEFAULT_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function TagsPage() {
  const [tagList, setTagList] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await tagsApi.list();
      setTagList(data);
    } catch {
      setError("Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await tagsApi.create({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || DEFAULT_COLORS[0]);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setError(null);
    try {
      await tagsApi.update(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update tag");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await tagsApi.delete(id);
      setDeletingId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag");
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tags</h2>
      </div>

      {/* Create form */}
      <div className="mb-6 flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border-0"
          title="Tag color"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New tag name..."
          maxLength={100}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Tag list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading tags...</p>
        ) : tagList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tags yet. Create one above.</p>
        ) : (
          tagList.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              {editingId === tag.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={100}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </>
              ) : deletingId === tag.id ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#9ca3af" }}
                  />
                  <span className="flex-1 text-sm text-red-700">
                    Delete &ldquo;{tag.name}&rdquo;?{" "}
                    {tag._count?.tasks ? `${tag._count.tasks} task${tag._count.tasks === 1 ? "" : "s"} will be untagged.` : ""}
                  </span>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeletingId(null)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || "#9ca3af" }}
                  />
                  <span className="flex-1 text-sm text-gray-900">{tag.name}</span>
                  <span className="text-xs text-gray-400">
                    {tag._count?.tasks ?? 0} task{(tag._count?.tasks ?? 0) === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={() => handleStartEdit(tag)}
                    className="px-3 py-1 text-gray-500 text-xs font-medium rounded hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingId(tag.id)}
                    className="px-3 py-1 text-red-500 text-xs font-medium rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `npm run build --workspace=client`
Expected: Compiles cleanly

**Step 3: Commit**

```bash
git add client/src/pages/TagsPage.tsx
git commit -m "feat: implement TagsPage with full CRUD and usage counts"
```

---

### Task 7: Client — TagTasks filtered view

**Files:**
- Modify: `client/src/pages/TagTasks.tsx` (replace placeholder)

**Step 1: Implement TagTasks**

Replace the placeholder in `client/src/pages/TagTasks.tsx`:

```tsx
import { useState, useEffect } from "react";
import type { Task, Tag } from "../lib/types";
import { tasks as tasksApi, tags as tagsApi } from "../lib/api";
import { TaskRow } from "../components/TaskRow";
import { TaskDetailPanel } from "../components/TaskDetailPanel";

interface TagTasksProps {
  tagId: string;
}

export function TagTasks({ tagId }: TagTasksProps) {
  const [tag, setTag] = useState<Tag | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [allTags, data] = await Promise.all([
        tagsApi.list(),
        tasksApi.listFiltered({ tagId }),
      ]);
      setTag(allTags.find(t => t.id === tagId) || null);
      setTaskList(data);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tagId]);

  const handleToggle = async (id: string) => {
    try {
      await tasksApi.toggleComplete(id);
      load();
    } catch {
      setError("Failed to toggle task");
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        {tag && (
          <>
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tag.color || "#9ca3af" }}
            />
            <h2 className="text-2xl font-bold text-gray-900">{tag.name}</h2>
            <span className="text-sm text-gray-400">
              {taskList.length} task{taskList.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-8 text-gray-400 text-sm">Loading tasks...</p>
        ) : taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks with this tag.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={setSelectedTask} showProject />
          ))
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { load(); setSelectedTask(null); }}
        />
      )}
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `npm run build --workspace=client`
Expected: Compiles cleanly

**Step 3: Commit**

```bash
git add client/src/pages/TagTasks.tsx
git commit -m "feat: implement TagTasks filtered view page"
```

---

### Task 8: Integration test run

**Step 1: Run all server tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS

**Step 2: Build both workspaces**

Run: `npm run build --workspace=server && npm run build --workspace=client`
Expected: Both compile cleanly

**Step 3: Commit any fixups if needed**

```bash
git add -A && git commit -m "fix: integration fixups" || echo "Nothing to fix"
```
