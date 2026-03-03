# AI Project Context + CRUD Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the AI assistant full awareness of the currently open project via system prompt injection, and add tag updates, task filtering/sorting, and bulk operations with full AI tool parity.

**Architecture:** System prompt injection approach — client sends `activeProjectId` with chat messages, server fetches project data and appends a context block to the system prompt. New REST endpoints for tag PATCH, task filtering query params, and bulk operations. Each new endpoint gets a matching AI tool definition + executor case.

**Tech Stack:** React (Vite), Express, Prisma/SQLite, OpenAI function calling, Vitest + Supertest

---

### Task 1: AI Context — Update agent.ts to accept project context

**Files:**
- Modify: `server/src/ai/agent.ts:12-18` (buildSystemPrompt), `server/src/ai/agent.ts:25-34` (streamChat signature)
- Test: `server/src/__tests__/agent-context.test.ts` (new file — unit test for buildSystemPrompt)

**Step 1: Write the failing test**

Create `server/src/__tests__/agent-context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../ai/agent.js";

describe("buildSystemPrompt", () => {
  it("returns base prompt without project context", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("AI assistant for a personal planner app");
    expect(prompt).not.toContain("Current Project Context");
  });

  it("includes project context when provided", () => {
    const context = '--- Current Project Context ---\nViewing "Test Project"';
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain("Current Project Context");
    expect(prompt).toContain("Test Project");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/agent-context.test.ts`
Expected: FAIL — `buildSystemPrompt` is not exported / doesn't accept params

**Step 3: Implement the changes**

In `server/src/ai/agent.ts`:

1. Export `buildSystemPrompt` and add optional `projectContext` parameter:

```typescript
export function buildSystemPrompt(projectContext?: string): string {
  let prompt = `You are an AI assistant for a personal planner app. Today is ${new Date().toISOString().split("T")[0]}.

You help the user manage their projects, tasks, and tags. Be concise and action-oriented.
When the user asks you to do something, use your tools to do it immediately — don't just describe what you would do.
After making changes, briefly confirm what you did.
When asked about workload or status, proactively check for overdue tasks and suggest priorities.`;

  if (projectContext) {
    prompt += `\n\n${projectContext}`;
  }
  return prompt;
}
```

2. Update `streamChat` signature to accept optional `projectContext`:

```typescript
export async function streamChat(
  res: Response,
  history: ChatCompletionMessageParam[],
  userMessage: string,
  abortSignal?: { aborted: boolean },
  projectContext?: string
): Promise<ChatCompletionMessageParam[]> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(projectContext) },
    ...history,
    { role: "user", content: userMessage },
  ];
  // ... rest unchanged
```

**Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/__tests__/agent-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/ai/agent.ts server/src/__tests__/agent-context.test.ts
git commit -m "feat: accept project context in AI system prompt"
```

---

### Task 2: AI Context — Update chat route to fetch project and build context

**Files:**
- Modify: `server/src/routes/chat.ts:44-48` (request body extraction), `server/src/routes/chat.ts:122` (streamChat call)

**Step 1: Write the failing test**

Add to `server/src/__tests__/chat.test.ts`:

```typescript
describe("POST /api/chat", () => {
  it("accepts activeProjectId in request body without error", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Context Test Project",
        tasks: {
          create: [{ title: "Task A", sortOrder: 0, priority: "HIGH" }],
        },
      },
    });

    // We can't easily test SSE streaming, but we can verify the endpoint
    // accepts the new field without 400 error.
    // The actual SSE test would require mocking OpenAI.
    // For now, just verify the request shape is accepted.
    const res = await request(app)
      .post("/api/chat")
      .send({
        message: "What tasks are in this project?",
        activeProjectId: project.id,
      });

    // SSE endpoint returns 200 with text/event-stream
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
  });
});
```

**Note:** This test will hit the real OpenAI API unless mocked. If OPENAI_API_KEY is not set in test env, expect an error SSE event — but the test validates the endpoint accepts the new field. If the test environment has no API key, adjust the assertion to check for 200 status (SSE headers are set before the OpenAI call).

**Step 2: Run test to verify current behavior**

Run: `cd server && npx vitest run src/__tests__/chat.test.ts`

**Step 3: Implement the context-building logic**

In `server/src/routes/chat.ts`, update the POST /api/chat handler:

1. Extract `activeProjectId` from request body (line 45):

```typescript
const { conversationId, message, activeProjectId } = req.body as {
  conversationId?: string;
  message: string;
  activeProjectId?: string;
};
```

2. After getting the conversation (after line 81), fetch project context:

```typescript
// Build project context for AI system prompt
let projectContext: string | undefined;
if (activeProjectId && typeof activeProjectId === "string" && activeProjectId.length < 100) {
  const project = await prisma.project.findUnique({
    where: { id: activeProjectId },
    include: {
      tasks: {
        include: { tags: { include: { tag: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (project) {
    const pending = project.tasks.filter(t => !t.completed).length;
    const completed = project.tasks.filter(t => t.completed).length;
    const overdue = project.tasks.filter(t => !t.completed && t.dueDate && t.dueDate < new Date()).length;

    const taskLines = project.tasks.map(t => {
      const check = t.completed ? "x" : " ";
      const priority = t.priority !== "MEDIUM" ? ` (${t.priority})` : "";
      const due = t.dueDate ? `, due ${t.dueDate.toISOString().split("T")[0]}` : "";
      const tagNames = t.tags.map(tt => tt.tag.name).join(", ");
      const tags = tagNames ? ` [${tagNames}]` : "";
      return `- [${check}] ${t.title}${priority}${due}${tags}`;
    }).join("\n");

    projectContext = `--- Current Project Context ---
The user is currently viewing project "${project.name}" (ID: ${project.id}).
Description: ${project.description || "None"}
Status: ${pending} pending, ${completed} completed, ${overdue} overdue tasks.

Tasks:
${taskLines || "(no tasks)"}

Default new tasks to this project unless the user specifies otherwise.
When discussing "this project" or "here", refer to this project.`;
  }
}
```

3. Pass `projectContext` to `streamChat` (line 122):

```typescript
const newMessages = await streamChat(res, history, message, abortSignal, projectContext);
```

**Step 4: Run tests**

Run: `cd server && npx vitest run`
Expected: All existing tests PASS, new test PASS

**Step 5: Commit**

```bash
git add server/src/routes/chat.ts server/src/__tests__/chat.test.ts
git commit -m "feat: fetch project context and inject into AI system prompt"
```

---

### Task 3: AI Context — Update ChatPanel to send activeProjectId

**Files:**
- Modify: `client/src/components/ChatPanel.tsx:19-23` (props interface), `client/src/components/ChatPanel.tsx:155-162` (fetch call)
- Modify: `client/src/App.tsx:77-81` (ChatPanel render)

**Step 1: Update ChatPanel props and fetch**

In `client/src/components/ChatPanel.tsx`:

1. Add `activeProjectId` to props interface (line 19-23):

```typescript
interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
  activeProjectId: string | null;
}
```

2. Destructure the new prop in the component function:

```typescript
export function ChatPanel({ open, onClose, onDataChange, activeProjectId }: ChatPanelProps) {
```

3. Include `activeProjectId` in the fetch body (lines 155-162):

```typescript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    conversationId: activeConversationId,
    message: userMsg,
    ...(activeProjectId && { activeProjectId }),
  }),
});
```

**Step 2: Pass prop from App.tsx**

In `client/src/App.tsx`, add `activeProjectId` to the ChatPanel render (lines 77-81):

```tsx
<ChatPanel
  open={chatOpen}
  onClose={() => setChatOpen(false)}
  onDataChange={handleDataChange}
  activeProjectId={activeProjectId}
/>
```

**Step 3: Build and verify**

Run: `npm run build --workspace=client`
Expected: TypeScript compiles with no errors

**Step 4: Commit**

```bash
git add client/src/components/ChatPanel.tsx client/src/App.tsx
git commit -m "feat: pass activeProjectId from App through ChatPanel to chat API"
```

---

### Task 4: Tag Update — Add PATCH /api/tags/:id route

**Files:**
- Modify: `server/src/routes/tags.ts:42-52` (add before DELETE route)
- Test: `server/src/__tests__/tags.test.ts` (add tests)

**Step 1: Write failing tests**

Add to `server/src/__tests__/tags.test.ts`, inside an appropriate describe block:

```typescript
describe("PATCH /api/tags/:id", () => {
  it("updates tag name", async () => {
    const tag = await prisma.tag.create({ data: { name: `old-${Date.now()}`, color: "#ff0000" } });
    const newName = `new-${Date.now()}`;
    const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: newName });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
    expect(res.body.color).toBe("#ff0000");
  });

  it("updates tag color", async () => {
    const tag = await prisma.tag.create({ data: { name: `color-${Date.now()}` } });
    const res = await request(app).patch(`/api/tags/${tag.id}`).send({ color: "#00ff00" });
    expect(res.status).toBe(200);
    expect(res.body.color).toBe("#00ff00");
  });

  it("returns 404 for non-existent tag", async () => {
    const res = await request(app).patch("/api/tags/nonexistent").send({ name: "nope" });
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate name", async () => {
    const existing = await prisma.tag.create({ data: { name: `dup-${Date.now()}` } });
    const tag = await prisma.tag.create({ data: { name: `other-${Date.now()}` } });
    const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: existing.name });
    expect(res.status).toBe(409);
  });

  it("rejects invalid color", async () => {
    const tag = await prisma.tag.create({ data: { name: `badcolor-${Date.now()}` } });
    const res = await request(app).patch(`/api/tags/${tag.id}`).send({ color: "not-a-color" });
    expect(res.status).toBe(400);
  });

  it("rejects empty name", async () => {
    const tag = await prisma.tag.create({ data: { name: `emptyname-${Date.now()}` } });
    const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: "   " });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tags.test.ts`
Expected: FAIL — 404 (no PATCH route exists)

**Step 3: Implement PATCH route**

In `server/src/routes/tags.ts`, add before the DELETE route (before line 43):

```typescript
// PATCH /api/tags/:id
router.patch("/:id", async (req, res) => {
  const { name, color } = req.body;

  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Name must be a non-empty string" });
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be under ${MAX_NAME_LENGTH} characters` });
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName !== existing.name) {
      const duplicate = await prisma.tag.findUnique({ where: { name: trimmedName } });
      if (duplicate) {
        res.status(409).json({ error: "Tag name already exists" });
        return;
      }
    }
  }

  if (color !== undefined && color !== null && (typeof color !== "string" || !COLOR_REGEX.test(color))) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }

  const tag = await prisma.tag.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(color !== undefined && { color: color || null }),
    },
  });
  res.json(tag);
});
```

**Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/__tests__/tags.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/tags.ts server/src/__tests__/tags.test.ts
git commit -m "feat: add PATCH /api/tags/:id for tag updates"
```

---

### Task 5: Tag Update — Add update_tag AI tool

**Files:**
- Modify: `server/src/ai/tools.ts` (add update_tag definition after create_tag at line 273)
- Modify: `server/src/ai/toolExecutor.ts` (add update_tag case after create_tag at line 184)

**Step 1: Write failing test**

Add to `server/src/__tests__/tags.test.ts` or create a new AI tools test:

```typescript
describe("update_tag AI tool", () => {
  it("updates tag via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const tag = await prisma.tag.create({ data: { name: `ai-tag-${Date.now()}`, color: "#111111" } });
    const result = await executeTool("update_tag", { tagId: tag.id, name: `updated-${Date.now()}`, color: "#222222" });
    expect(result).toHaveProperty("name");
    expect((result as { color: string }).color).toBe("#222222");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/__tests__/tags.test.ts`
Expected: FAIL — "Unknown tool: update_tag"

**Step 3: Add tool definition and executor case**

In `server/src/ai/tools.ts`, add after the create_tag definition (after line 273):

```typescript
{
  type: "function",
  function: {
    name: "update_tag",
    description: "Update an existing tag's name or color.",
    parameters: {
      type: "object",
      properties: {
        tagId: {
          type: "string",
          description: "The ID of the tag to update.",
        },
        name: {
          type: "string",
          description: "The new name for the tag.",
        },
        color: {
          type: "string",
          description: "The new hex color code for the tag (e.g. '#ef4444').",
        },
      },
      required: ["tagId"],
    },
  },
},
```

In `server/src/ai/toolExecutor.ts`, add after the create_tag case (after line 184):

```typescript
case "update_tag": {
  const tagId = requireString(args, "tagId");
  const existing = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!existing) throw new Error(`Tag not found: ${tagId}`);
  const data: Record<string, unknown> = {};
  if (args.name !== undefined) {
    const newName = requireString(args, "name", 100);
    if (newName !== existing.name) {
      const duplicate = await prisma.tag.findUnique({ where: { name: newName } });
      if (duplicate) throw new Error(`Tag name already exists: ${newName}`);
    }
    data.name = newName;
  }
  if (args.color !== undefined) data.color = validateColor(args.color);
  return prisma.tag.update({ where: { id: tagId }, data });
}
```

**Step 4: Run tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 5: Update ChatPanel friendly names**

In `client/src/components/ChatPanel.tsx`, add to the `friendlyNames` object inside `ToolCallCard`:

```typescript
update_tag: "Updated tag",
```

**Step 6: Commit**

```bash
git add server/src/ai/tools.ts server/src/ai/toolExecutor.ts client/src/components/ChatPanel.tsx
git commit -m "feat: add update_tag AI tool with validation"
```

---

### Task 6: Task Filtering & Sorting — Enhanced GET /api/tasks

**Files:**
- Modify: `server/src/routes/tasks.ts:15-22` (GET /api/tasks handler)
- Test: `server/src/__tests__/tasks.test.ts`

**Step 1: Write failing tests**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("GET /api/tasks (filtering & sorting)", () => {
  let projectId: string;

  beforeEach(async () => {
    const project = await prisma.project.create({ data: { name: `filter-${Date.now()}` } });
    projectId = project.id;
    await prisma.task.createMany({
      data: [
        { title: "A-Low", priority: "LOW", completed: false, sortOrder: 0, projectId, dueDate: new Date("2026-03-10") },
        { title: "B-High", priority: "HIGH", completed: false, sortOrder: 1, projectId, dueDate: new Date("2026-03-05") },
        { title: "C-Done", priority: "MEDIUM", completed: true, completedAt: new Date(), sortOrder: 2, projectId },
      ],
    });
  });

  it("filters by projectId", async () => {
    const res = await request(app).get(`/api/tasks?projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it("filters by completed=false", async () => {
    const res = await request(app).get(`/api/tasks?completed=false&projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.every((t: { completed: boolean }) => !t.completed)).toBe(true);
  });

  it("filters by priority", async () => {
    const res = await request(app).get(`/api/tasks?priority=HIGH&projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.every((t: { priority: string }) => t.priority === "HIGH")).toBe(true);
  });

  it("filters by dueBefore", async () => {
    const res = await request(app).get(`/api/tasks?dueBefore=2026-03-08&projectId=${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((t: { title: string }) => t.title === "B-High")).toBe(true);
  });

  it("sorts by priority desc", async () => {
    const res = await request(app).get(`/api/tasks?sortBy=priority&sortOrder=desc&projectId=${projectId}`);
    expect(res.status).toBe(200);
    // HIGH before LOW in desc order
    const priorities = res.body.map((t: { priority: string }) => t.priority);
    expect(priorities.indexOf("HIGH")).toBeLessThan(priorities.indexOf("LOW"));
  });

  it("sorts by dueDate asc", async () => {
    const res = await request(app).get(`/api/tasks?sortBy=dueDate&sortOrder=asc&projectId=${projectId}`);
    expect(res.status).toBe(200);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL — current GET /api/tasks ignores query params

**Step 3: Implement filtered task listing**

Replace the GET /api/tasks handler in `server/src/routes/tasks.ts` (lines 15-22):

```typescript
// GET /api/tasks (with optional filters & sorting)
router.get("/tasks", async (req, res) => {
  const where: Record<string, unknown> = {};

  // Filter: projectId
  if (req.query.projectId && typeof req.query.projectId === "string") {
    where.projectId = req.query.projectId;
  }

  // Filter: completed
  if (req.query.completed === "true") where.completed = true;
  else if (req.query.completed === "false") where.completed = false;

  // Filter: priority (comma-separated)
  if (req.query.priority && typeof req.query.priority === "string") {
    const priorities = req.query.priority.split(",").filter(p => VALID_PRIORITIES.includes(p));
    if (priorities.length === 1) where.priority = priorities[0];
    else if (priorities.length > 1) where.priority = { in: priorities };
  }

  // Filter: dueBefore / dueAfter
  const dueDateFilter: Record<string, Date> = {};
  if (req.query.dueBefore && typeof req.query.dueBefore === "string" && isValidDate(req.query.dueBefore)) {
    dueDateFilter.lte = new Date(req.query.dueBefore as string);
  }
  if (req.query.dueAfter && typeof req.query.dueAfter === "string" && isValidDate(req.query.dueAfter)) {
    dueDateFilter.gte = new Date(req.query.dueAfter as string);
  }
  if (Object.keys(dueDateFilter).length > 0) {
    where.dueDate = dueDateFilter;
  }

  // Sort
  const VALID_SORT_FIELDS = ["dueDate", "priority", "createdAt", "title"];
  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (req.query.sortBy && typeof req.query.sortBy === "string" && VALID_SORT_FIELDS.includes(req.query.sortBy)) {
    const dir = req.query.sortOrder === "desc" ? "desc" : "asc";
    orderBy = { [req.query.sortBy]: dir };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: { tags: { include: { tag: true } }, project: true },
    orderBy,
  });
  res.json(tasks);
});
```

**Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/tasks.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add filtering and sorting to GET /api/tasks"
```

---

### Task 7: Task Filtering — Enhanced list_tasks AI tool

**Files:**
- Modify: `server/src/ai/tools.ts:107-132` (list_tasks definition — add dueBefore, dueAfter, sortBy, sortOrder params)
- Modify: `server/src/ai/toolExecutor.ts:106-116` (list_tasks case — add filter/sort logic)

**Step 1: Write failing test**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("list_tasks AI tool (enhanced)", () => {
  it("filters by dueBefore via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const project = await prisma.project.create({ data: { name: `aitool-${Date.now()}` } });
    await prisma.task.create({
      data: { title: "Soon", projectId: project.id, sortOrder: 0, dueDate: new Date("2026-03-05") },
    });
    await prisma.task.create({
      data: { title: "Later", projectId: project.id, sortOrder: 1, dueDate: new Date("2026-12-01") },
    });
    const result = await executeTool("list_tasks", { projectId: project.id, dueBefore: "2026-03-10" }) as unknown[];
    expect(result.length).toBe(1);
    expect((result[0] as { title: string }).title).toBe("Soon");
  });

  it("sorts by dueDate via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const project = await prisma.project.create({ data: { name: `aisort-${Date.now()}` } });
    await prisma.task.create({
      data: { title: "Later", projectId: project.id, sortOrder: 0, dueDate: new Date("2026-06-01") },
    });
    await prisma.task.create({
      data: { title: "Soon", projectId: project.id, sortOrder: 1, dueDate: new Date("2026-03-01") },
    });
    const result = await executeTool("list_tasks", { projectId: project.id, sortBy: "dueDate", sortOrder: "asc" }) as { title: string }[];
    expect(result[0].title).toBe("Soon");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL — current list_tasks ignores dueBefore/sortBy params

**Step 3: Update tool definition**

In `server/src/ai/tools.ts`, replace the list_tasks tool definition (lines 107-132):

```typescript
{
  type: "function",
  function: {
    name: "list_tasks",
    description:
      "List tasks with optional filters by project, completion status, priority, due date range, and sorting.",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Filter tasks to a specific project.",
        },
        completed: {
          type: "boolean",
          description: "Filter by completion status (true or false).",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          description: "Filter by priority level.",
        },
        dueBefore: {
          type: "string",
          description: "Only include tasks due on or before this date (ISO 8601 format).",
        },
        dueAfter: {
          type: "string",
          description: "Only include tasks due on or after this date (ISO 8601 format).",
        },
        sortBy: {
          type: "string",
          enum: ["dueDate", "priority", "createdAt", "title"],
          description: "Field to sort by. Defaults to createdAt.",
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort direction. Defaults to desc.",
        },
      },
      required: [],
    },
  },
},
```

**Step 4: Update executor case**

In `server/src/ai/toolExecutor.ts`, replace the list_tasks case (lines 106-116):

```typescript
case "list_tasks": {
  const where: Record<string, unknown> = {};
  if (args.projectId) where.projectId = args.projectId as string;
  if (args.completed !== undefined) where.completed = args.completed as boolean;
  if (args.priority) where.priority = args.priority as Priority;

  // Date range filters
  const dueDateFilter: Record<string, Date> = {};
  if (args.dueBefore) {
    const d = validateDueDate(args.dueBefore);
    if (d) dueDateFilter.lte = d;
  }
  if (args.dueAfter) {
    const d = validateDueDate(args.dueAfter);
    if (d) dueDateFilter.gte = d;
  }
  if (Object.keys(dueDateFilter).length > 0) {
    where.dueDate = dueDateFilter;
  }

  // Sorting
  const VALID_SORT_FIELDS = ["dueDate", "priority", "createdAt", "title"];
  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (args.sortBy && typeof args.sortBy === "string" && VALID_SORT_FIELDS.includes(args.sortBy)) {
    const dir = args.sortOrder === "asc" ? "asc" : "desc";
    orderBy = { [args.sortBy]: dir };
  }

  return prisma.task.findMany({
    where,
    include: { tags: { include: { tag: true } }, project: true },
    orderBy,
  });
}
```

**Step 5: Run tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add server/src/ai/tools.ts server/src/ai/toolExecutor.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add filtering and sorting to list_tasks AI tool"
```

---

### Task 8: Bulk Complete — PATCH /api/tasks/bulk-complete

**Files:**
- Modify: `server/src/routes/tasks.ts` (add before the reorder route, after due-soon)
- Test: `server/src/__tests__/tasks.test.ts`

**Step 1: Write failing tests**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("PATCH /api/tasks/bulk-complete", () => {
  it("bulk completes multiple tasks", async () => {
    const project = await prisma.project.create({ data: { name: `bulk-${Date.now()}` } });
    const t1 = await prisma.task.create({ data: { title: "T1", projectId: project.id, sortOrder: 0 } });
    const t2 = await prisma.task.create({ data: { title: "T2", projectId: project.id, sortOrder: 1 } });
    const res = await request(app)
      .patch("/api/tasks/bulk-complete")
      .send({ taskIds: [t1.id, t2.id], completed: true });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const updated = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    expect(updated.every(t => t.completed)).toBe(true);
  });

  it("bulk uncompletes tasks", async () => {
    const project = await prisma.project.create({ data: { name: `bulkun-${Date.now()}` } });
    const t = await prisma.task.create({
      data: { title: "Done", projectId: project.id, sortOrder: 0, completed: true, completedAt: new Date() },
    });
    const res = await request(app)
      .patch("/api/tasks/bulk-complete")
      .send({ taskIds: [t.id], completed: false });
    expect(res.status).toBe(200);
    const updated = await prisma.task.findUnique({ where: { id: t.id } });
    expect(updated!.completed).toBe(false);
    expect(updated!.completedAt).toBeNull();
  });

  it("rejects empty taskIds array", async () => {
    const res = await request(app).patch("/api/tasks/bulk-complete").send({ taskIds: [], completed: true });
    expect(res.status).toBe(400);
  });

  it("rejects more than 50 taskIds", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
    const res = await request(app).patch("/api/tasks/bulk-complete").send({ taskIds: ids, completed: true });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL — 404

**Step 3: Add bulk-complete validation helper and route**

In `server/src/routes/tasks.ts`, add a validation helper near the top (after the constants):

```typescript
const MAX_BULK_IDS = 50;

function validateTaskIds(taskIds: unknown): string[] | null {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return null;
  if (taskIds.length > MAX_BULK_IDS) return null;
  if (!taskIds.every(id => typeof id === "string" && id.trim().length > 0 && id.length < 100)) return null;
  return taskIds as string[];
}
```

Add the bulk-complete route after the due-soon route and **before** the reorder route (important for route ordering — "bulk-complete" must not be matched as `:id`):

```typescript
// PATCH /api/tasks/bulk-complete
router.patch("/tasks/bulk-complete", async (req, res) => {
  const { taskIds: rawIds, completed } = req.body;
  const taskIds = validateTaskIds(rawIds);
  if (!taskIds) {
    res.status(400).json({ error: `taskIds must be a non-empty array of up to ${MAX_BULK_IDS} IDs` });
    return;
  }
  if (typeof completed !== "boolean") {
    res.status(400).json({ error: "completed must be a boolean" });
    return;
  }

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
    },
  });
  res.json({ count: result.count });
});
```

**Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/tasks.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add PATCH /api/tasks/bulk-complete endpoint"
```

---

### Task 9: Bulk Delete — POST /api/tasks/bulk-delete

**Files:**
- Modify: `server/src/routes/tasks.ts` (add after bulk-complete route)
- Test: `server/src/__tests__/tasks.test.ts`

**Step 1: Write failing tests**

```typescript
describe("POST /api/tasks/bulk-delete", () => {
  it("deletes multiple tasks", async () => {
    const project = await prisma.project.create({ data: { name: `bulkdel-${Date.now()}` } });
    const t1 = await prisma.task.create({ data: { title: "Del1", projectId: project.id, sortOrder: 0 } });
    const t2 = await prisma.task.create({ data: { title: "Del2", projectId: project.id, sortOrder: 1 } });
    const res = await request(app)
      .post("/api/tasks/bulk-delete")
      .send({ taskIds: [t1.id, t2.id] });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const remaining = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    expect(remaining).toHaveLength(0);
  });

  it("rejects empty taskIds", async () => {
    const res = await request(app).post("/api/tasks/bulk-delete").send({ taskIds: [] });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL

**Step 3: Add bulk-delete route**

In `server/src/routes/tasks.ts`, add after bulk-complete (before reorder):

```typescript
// POST /api/tasks/bulk-delete (POST to allow request body)
router.post("/tasks/bulk-delete", async (req, res) => {
  const taskIds = validateTaskIds(req.body.taskIds);
  if (!taskIds) {
    res.status(400).json({ error: `taskIds must be a non-empty array of up to ${MAX_BULK_IDS} IDs` });
    return;
  }

  await prisma.$transaction([
    prisma.taskTag.deleteMany({ where: { taskId: { in: taskIds } } }),
    prisma.task.deleteMany({ where: { id: { in: taskIds } } }),
  ]);
  const result = { count: taskIds.length };
  res.json(result);
});
```

**Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/tasks.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add POST /api/tasks/bulk-delete endpoint"
```

---

### Task 10: Bulk Move — PATCH /api/tasks/bulk-move

**Files:**
- Modify: `server/src/routes/tasks.ts` (add after bulk-delete route)
- Test: `server/src/__tests__/tasks.test.ts`

**Step 1: Write failing tests**

```typescript
describe("PATCH /api/tasks/bulk-move", () => {
  it("moves tasks to a different project", async () => {
    const p1 = await prisma.project.create({ data: { name: `src-${Date.now()}` } });
    const p2 = await prisma.project.create({ data: { name: `dst-${Date.now()}` } });
    const t1 = await prisma.task.create({ data: { title: "Move1", projectId: p1.id, sortOrder: 0 } });
    const t2 = await prisma.task.create({ data: { title: "Move2", projectId: p1.id, sortOrder: 1 } });
    const res = await request(app)
      .patch("/api/tasks/bulk-move")
      .send({ taskIds: [t1.id, t2.id], projectId: p2.id });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    const moved = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    expect(moved.every(t => t.projectId === p2.id)).toBe(true);
  });

  it("returns 404 for non-existent target project", async () => {
    const project = await prisma.project.create({ data: { name: `movesrc-${Date.now()}` } });
    const t = await prisma.task.create({ data: { title: "MoveX", projectId: project.id, sortOrder: 0 } });
    const res = await request(app)
      .patch("/api/tasks/bulk-move")
      .send({ taskIds: [t.id], projectId: "nonexistent" });
    expect(res.status).toBe(404);
  });

  it("rejects missing projectId", async () => {
    const res = await request(app)
      .patch("/api/tasks/bulk-move")
      .send({ taskIds: ["some-id"] });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Add bulk-move route**

In `server/src/routes/tasks.ts`, add after bulk-delete (before reorder):

```typescript
// PATCH /api/tasks/bulk-move
router.patch("/tasks/bulk-move", async (req, res) => {
  const { taskIds: rawIds, projectId } = req.body;
  const taskIds = validateTaskIds(rawIds);
  if (!taskIds) {
    res.status(400).json({ error: `taskIds must be a non-empty array of up to ${MAX_BULK_IDS} IDs` });
    return;
  }
  if (!projectId || typeof projectId !== "string") {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: "Target project not found" });
    return;
  }

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: { projectId },
  });
  res.json({ count: result.count });
});
```

**Step 4: Run tests**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/tasks.ts server/src/__tests__/tasks.test.ts
git commit -m "feat: add PATCH /api/tasks/bulk-move endpoint"
```

---

### Task 11: Bulk Operations — AI tools

**Files:**
- Modify: `server/src/ai/tools.ts` (add 3 new tool definitions)
- Modify: `server/src/ai/toolExecutor.ts` (add 3 new cases)
- Modify: `client/src/components/ChatPanel.tsx` (add friendly names)

**Step 1: Write failing tests**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("bulk AI tools", () => {
  it("bulk_complete_tasks via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const project = await prisma.project.create({ data: { name: `aibulk-${Date.now()}` } });
    const t1 = await prisma.task.create({ data: { title: "BT1", projectId: project.id, sortOrder: 0 } });
    const t2 = await prisma.task.create({ data: { title: "BT2", projectId: project.id, sortOrder: 1 } });
    const result = await executeTool("bulk_complete_tasks", { taskIds: [t1.id, t2.id], completed: true });
    expect(result).toHaveProperty("count", 2);
  });

  it("bulk_delete_tasks via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const project = await prisma.project.create({ data: { name: `aibulkdel-${Date.now()}` } });
    const t = await prisma.task.create({ data: { title: "BD1", projectId: project.id, sortOrder: 0 } });
    const result = await executeTool("bulk_delete_tasks", { taskIds: [t.id] });
    expect(result).toHaveProperty("count");
  });

  it("bulk_move_tasks via toolExecutor", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    const p1 = await prisma.project.create({ data: { name: `aibulkmov1-${Date.now()}` } });
    const p2 = await prisma.project.create({ data: { name: `aibulkmov2-${Date.now()}` } });
    const t = await prisma.task.create({ data: { title: "BM1", projectId: p1.id, sortOrder: 0 } });
    const result = await executeTool("bulk_move_tasks", { taskIds: [t.id], projectId: p2.id });
    expect(result).toHaveProperty("count", 1);
  });

  it("bulk_complete_tasks rejects empty array", async () => {
    const { executeTool } = await import("../ai/toolExecutor.js");
    await expect(executeTool("bulk_complete_tasks", { taskIds: [], completed: true }))
      .rejects.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: FAIL — "Unknown tool"

**Step 3: Add tool definitions**

In `server/src/ai/tools.ts`, add after get_workload_summary (at the end of the array):

```typescript
{
  type: "function",
  function: {
    name: "bulk_complete_tasks",
    description: "Mark multiple tasks as completed or uncompleted at once.",
    parameters: {
      type: "object",
      properties: {
        taskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs to update (max 50).",
        },
        completed: {
          type: "boolean",
          description: "Set to true to mark complete, false to mark incomplete.",
        },
      },
      required: ["taskIds", "completed"],
    },
  },
},
{
  type: "function",
  function: {
    name: "bulk_delete_tasks",
    description: "Delete multiple tasks at once. This cannot be undone.",
    parameters: {
      type: "object",
      properties: {
        taskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs to delete (max 50).",
        },
      },
      required: ["taskIds"],
    },
  },
},
{
  type: "function",
  function: {
    name: "bulk_move_tasks",
    description: "Move multiple tasks to a different project.",
    parameters: {
      type: "object",
      properties: {
        taskIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of task IDs to move (max 50).",
        },
        projectId: {
          type: "string",
          description: "The ID of the target project to move tasks to.",
        },
      },
      required: ["taskIds", "projectId"],
    },
  },
},
```

**Step 4: Add executor cases**

In `server/src/ai/toolExecutor.ts`, add a validation helper near the top:

```typescript
const MAX_BULK_IDS = 50;

function validateTaskIdsArg(args: Record<string, unknown>): string[] {
  const ids = args.taskIds;
  if (!Array.isArray(ids) || ids.length === 0) throw new Error("taskIds must be a non-empty array");
  if (ids.length > MAX_BULK_IDS) throw new Error(`taskIds can contain at most ${MAX_BULK_IDS} items`);
  if (!ids.every(id => typeof id === "string" && id.trim())) throw new Error("Each taskId must be a non-empty string");
  return ids as string[];
}
```

Add cases before the default case:

```typescript
case "bulk_complete_tasks": {
  const taskIds = validateTaskIdsArg(args);
  const completed = args.completed as boolean;
  if (typeof completed !== "boolean") throw new Error("completed must be a boolean");
  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: { completed, completedAt: completed ? new Date() : null },
  });
  return { count: result.count };
}

case "bulk_delete_tasks": {
  const taskIds = validateTaskIdsArg(args);
  await prisma.$transaction([
    prisma.taskTag.deleteMany({ where: { taskId: { in: taskIds } } }),
    prisma.task.deleteMany({ where: { id: { in: taskIds } } }),
  ]);
  return { count: taskIds.length };
}

case "bulk_move_tasks": {
  const taskIds = validateTaskIdsArg(args);
  const projectId = requireString(args, "projectId");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data: { projectId },
  });
  return { count: result.count };
}
```

**Step 5: Update ChatPanel friendly names**

In `client/src/components/ChatPanel.tsx`, add to the `friendlyNames` object:

```typescript
bulk_complete_tasks: "Bulk completed tasks",
bulk_delete_tasks: "Bulk deleted tasks",
bulk_move_tasks: "Bulk moved tasks",
```

**Step 6: Run all tests**

Run: `cd server && npx vitest run`
Expected: All PASS

**Step 7: Commit**

```bash
git add server/src/ai/tools.ts server/src/ai/toolExecutor.ts server/src/__tests__/tasks.test.ts client/src/components/ChatPanel.tsx
git commit -m "feat: add bulk AI tools (complete, delete, move)"
```

---

### Task 12: Client API wrapper updates

**Files:**
- Modify: `client/src/lib/api.ts` (add tag update and bulk operation methods)

**Step 1: Add new API methods**

In `client/src/lib/api.ts`:

Add `update` to the tags object:

```typescript
export const tags = {
  list: () => request<Tag[]>("/tags"),
  create: (data: { name: string; color?: string }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; color?: string }) =>
    request<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: "DELETE" }),
};
```

Add bulk methods to the tasks object:

```typescript
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
```

Add `listFiltered` to tasks:

```typescript
listFiltered: (params: {
  projectId?: string;
  completed?: boolean;
  priority?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: string;
  sortOrder?: string;
}) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }
  return request<Task[]>(`/tasks?${searchParams.toString()}`);
},
```

**Step 2: Build and verify**

Run: `npm run build --workspace=client`
Expected: TypeScript compiles with no errors

**Step 3: Commit**

```bash
git add client/src/lib/api.ts
git commit -m "feat: add tag update and bulk operation client API methods"
```

---

### Task 13: Full integration test run

**Step 1: Run all server tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS (59 existing + ~20 new)

**Step 2: Build both workspaces**

Run: `npm run build --workspace=server && npm run build --workspace=client`
Expected: Both compile cleanly

**Step 3: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: test and build fixes from integration run"
```
