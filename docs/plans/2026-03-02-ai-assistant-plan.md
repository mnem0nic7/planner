# AI Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full autonomous AI assistant to the planner app that can manage projects, tasks, and tags through natural language, powered by OpenAI gpt-4o with streaming responses.

**Architecture:** Server-side streaming agent. Express handles the OpenAI conversation loop, executes tool calls against Prisma, streams responses via SSE. Client renders a push-aside side panel with floating action button.

**Tech Stack:** OpenAI SDK (`openai` npm package), Express SSE, Prisma (SQLite), React, Tailwind CSS

---

### Task 1: Add Prisma models for Conversation and Message

**Files:**
- Modify: `server/prisma/schema.prisma`

**Step 1: Add Conversation and Message models to schema**

Append to the end of `server/prisma/schema.prisma`:

```prisma
model Conversation {
  id        String    @id @default(cuid())
  title     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  role           String
  content        String?
  toolCalls      String?
  toolCallId     String?
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  conversationId String
}
```

**Step 2: Push schema to database**

Run: `cd server && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema"

**Step 3: Verify by running existing tests**

Run: `cd server && npm test`
Expected: All 26 existing tests pass (the new models don't affect existing functionality)

**Step 4: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat: add Conversation and Message models for AI assistant"
```

---

### Task 2: Install OpenAI SDK

**Files:**
- Modify: `server/package.json` (via npm install)

**Step 1: Install the openai package**

Run: `cd server && npm install openai`

**Step 2: Add OPENAI_API_KEY to server/.env**

Append to `server/.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

**Step 3: Add to docker-compose.yml**

Add `OPENAI_API_KEY` to the environment section of `docker-compose.yml`:

```yaml
services:
  planner:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - planner-data:/app/data
    environment:
      - DATABASE_URL=file:/app/data/planner.db
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

**Step 4: Commit**

```bash
git add server/package.json server/package-lock.json docker-compose.yml
git commit -m "feat: add openai SDK dependency and env config"
```

Note: Do NOT commit `server/.env` (it's already in .gitignore).

---

### Task 3: Create AI tool definitions and executor

This is the core of the AI agent — the tool definitions that tell gpt-4o what it can do, and the executor that maps tool calls to Prisma operations.

**Files:**
- Create: `server/src/ai/tools.ts`
- Create: `server/src/ai/toolExecutor.ts`

**Step 1: Create tool definitions**

Create `server/src/ai/tools.ts` with OpenAI function calling schema for all 16 tools. Each tool definition includes a `name`, `description`, and `parameters` (JSON Schema).

The tools array should include:
- `list_projects` — no params
- `get_project` — `{ projectId: string }`
- `create_project` — `{ name: string, description?: string, color?: string }`
- `update_project` — `{ projectId: string, name?: string, description?: string, color?: string }`
- `delete_project` — `{ projectId: string }`
- `list_tasks` — `{ projectId?: string, completed?: boolean, priority?: string }`
- `create_task` — `{ projectId: string, title: string, description?: string, priority?: string, dueDate?: string }`
- `update_task` — `{ taskId: string, title?: string, description?: string, priority?: string, dueDate?: string }`
- `complete_task` — `{ taskId: string }`
- `delete_task` — `{ taskId: string }`
- `list_tags` — no params
- `create_tag` — `{ name: string, color?: string }`
- `add_tag_to_task` — `{ taskId: string, tagId: string }`
- `remove_tag_from_task` — `{ taskId: string, tagId: string }`
- `get_due_soon` — `{ days?: number }`
- `get_workload_summary` — no params

Export as `tools` array typed as `ChatCompletionTool[]` from the `openai` package.

**Step 2: Create tool executor**

Create `server/src/ai/toolExecutor.ts` that exports an `executeTool(name: string, args: Record<string, unknown>)` function. This function uses a switch statement to map each tool name to the corresponding Prisma query.

Pattern for each tool — reuse the exact Prisma queries from the existing route handlers:

```typescript
import { prisma } from "../db.js";

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_projects":
      return prisma.project.findMany({
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });

    case "get_project":
      return prisma.project.findUnique({
        where: { id: args.projectId as string },
        include: {
          tasks: {
            include: { tags: { include: { tag: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

    case "create_project":
      return prisma.project.create({
        data: {
          name: args.name as string,
          description: args.description as string | undefined,
          color: args.color as string | undefined,
        },
      });

    // ... all other tools follow the same pattern
    // copy Prisma queries from existing route handlers

    case "get_workload_summary": {
      const [total, completed, overdue, byPriority] = await Promise.all([
        prisma.task.count(),
        prisma.task.count({ where: { completed: true } }),
        prisma.task.count({
          where: { completed: false, dueDate: { lt: new Date() } },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          _count: true,
          where: { completed: false },
        }),
      ]);
      return { total, completed, pending: total - completed, overdue, byPriority };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

**Step 3: Run existing tests to verify no regressions**

Run: `cd server && npm test`
Expected: All 26 tests pass

**Step 4: Commit**

```bash
git add server/src/ai/tools.ts server/src/ai/toolExecutor.ts
git commit -m "feat: add AI tool definitions and executor for all planner operations"
```

---

### Task 4: Create the AI chat agent with streaming

The core agent loop: receives messages, calls OpenAI with streaming, handles tool calls iteratively, and streams results back via SSE.

**Files:**
- Create: `server/src/ai/agent.ts`

**Step 1: Create the agent module**

Create `server/src/ai/agent.ts`. This module exports a `streamChat` function that:

1. Accepts a `Response` object (for SSE), conversation history as OpenAI messages, and the user's new message
2. Creates a system prompt with the current date and instructions
3. Calls `openai.chat.completions.create()` with `stream: true`, the tools array, and conversation history
4. Processes the stream:
   - Accumulates content deltas → sends SSE `event: content` with `{"delta": "text"}`
   - Detects tool calls → sends SSE `event: tool_call` with `{"name": "...", "args": {...}}`
   - Executes tool calls via `executeTool()` → sends SSE `event: tool_result` with result
   - After tool execution, makes another OpenAI call with tool results (loop)
   - Loop terminates when OpenAI returns a response with no tool calls
5. Returns the complete assistant messages for DB storage

Key implementation details:

```typescript
import OpenAI from "openai";
import type { Response } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { tools } from "./tools.js";
import { executeTool } from "./toolExecutor.js";

const openai = new OpenAI(); // Uses OPENAI_API_KEY env var

const SYSTEM_PROMPT = `You are an AI assistant for a personal planner app. Today is ${new Date().toLocaleDateString()}.

You help the user manage their projects, tasks, and tags. Be concise and action-oriented.
When the user asks you to do something, use your tools to do it immediately — don't just describe what you would do.
After making changes, briefly confirm what you did.
When asked about workload or status, proactively check for overdue tasks and suggest priorities.`;

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

The streaming loop pattern:

```typescript
export async function streamChat(
  res: Response,
  history: ChatCompletionMessageParam[],
  userMessage: string
): Promise<ChatCompletionMessageParam[]> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  const newMessages: ChatCompletionMessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let continueLoop = true;

  while (continueLoop) {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      stream: true,
    });

    let contentAccumulator = "";
    const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Stream content tokens
      if (delta?.content) {
        contentAccumulator += delta.content;
        sendSSE(res, "content", { delta: delta.content });
      }

      // Accumulate tool calls
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAccumulators.has(tc.index)) {
            toolCallAccumulators.set(tc.index, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
          }
          const acc = toolCallAccumulators.get(tc.index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }

    // If there were tool calls, execute them
    if (toolCallAccumulators.size > 0) {
      const assistantMsg: ChatCompletionMessageParam = {
        role: "assistant",
        content: contentAccumulator || null,
        tool_calls: [...toolCallAccumulators.values()].map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMsg);
      newMessages.push(assistantMsg);

      // Execute each tool call
      for (const tc of toolCallAccumulators.values()) {
        const args = JSON.parse(tc.arguments);
        sendSSE(res, "tool_call", { id: tc.id, name: tc.name, args });

        try {
          const result = await executeTool(tc.name, args);
          sendSSE(res, "tool_result", { id: tc.id, name: tc.name, result });

          const toolMsg: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          const toolMsg: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errMsg }),
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
          sendSSE(res, "tool_result", { id: tc.id, name: tc.name, error: errMsg });
        }
      }
      // Loop continues — OpenAI will process tool results
    } else {
      // No tool calls — we're done
      if (contentAccumulator) {
        newMessages.push({ role: "assistant", content: contentAccumulator });
      }
      continueLoop = false;
    }
  }

  return newMessages;
}
```

**Step 2: Run existing tests**

Run: `cd server && npm test`
Expected: All 26 tests pass

**Step 3: Commit**

```bash
git add server/src/ai/agent.ts
git commit -m "feat: add streaming AI chat agent with tool call loop"
```

---

### Task 5: Create chat and conversation API routes

**Files:**
- Create: `server/src/routes/chat.ts`
- Modify: `server/src/app.ts`

**Step 1: Write the failing test**

Create `server/src/__tests__/chat.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Conversations API", () => {
  describe("GET /api/conversations", () => {
    it("returns empty array when no conversations exist", async () => {
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns conversations ordered by most recent", async () => {
      await prisma.conversation.create({ data: { title: "First" } });
      await prisma.conversation.create({ data: { title: "Second" } });
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("Second");
    });
  });

  describe("GET /api/conversations/:id", () => {
    it("returns conversation with messages", async () => {
      const conv = await prisma.conversation.create({
        data: {
          title: "Test",
          messages: {
            create: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi there!" },
            ],
          },
        },
      });
      const res = await request(app).get(`/api/conversations/${conv.id}`);
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
    });

    it("returns 404 for missing conversation", async () => {
      const res = await request(app).get("/api/conversations/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/conversations/:id", () => {
    it("deletes conversation and messages", async () => {
      const conv = await prisma.conversation.create({
        data: {
          title: "Delete me",
          messages: { create: [{ role: "user", content: "Hello" }] },
        },
      });
      const res = await request(app).delete(`/api/conversations/${conv.id}`);
      expect(res.status).toBe(204);

      const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
      });
      expect(messages).toHaveLength(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd server && npm test`
Expected: New tests FAIL (routes don't exist yet)

**Step 3: Create chat routes**

Create `server/src/routes/chat.ts`:

```typescript
import { Router } from "express";
import { prisma } from "../db.js";
import { streamChat } from "../ai/agent.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const router = Router();

// GET /api/conversations
router.get("/conversations", async (_req, res) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  res.json(conversations);
});

// GET /api/conversations/:id
router.get("/conversations/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(conversation);
});

// DELETE /api/conversations/:id
router.delete("/conversations/:id", async (req, res) => {
  await prisma.conversation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /api/chat — streaming SSE endpoint
router.post("/chat", async (req, res) => {
  const { conversationId, message } = req.body as {
    conversationId?: string;
    message: string;
  };

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { title: message.slice(0, 100) },
      include: { messages: true },
    });
  }

  // Rebuild OpenAI message history from DB
  const history: ChatCompletionMessageParam[] = conversation.messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        tool_call_id: m.toolCallId!,
        content: m.content || "",
      };
    }
    if (m.role === "assistant" && m.toolCalls) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: JSON.parse(m.toolCalls),
      };
    }
    return {
      role: m.role as "user" | "assistant",
      content: m.content || "",
    };
  });

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const newMessages = await streamChat(res, history, message);

    // Save all new messages to DB
    for (const msg of newMessages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : null,
          toolCalls: "tool_calls" in msg && msg.tool_calls
            ? JSON.stringify(msg.tool_calls)
            : null,
          toolCallId: "tool_call_id" in msg ? (msg.tool_call_id as string) : null,
        },
      });
    }

    // Update conversation title if it was auto-generated
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    sendSSE(res, "done", { conversationId: conversation.id });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    sendSSE(res, "error", { message: errMsg });
  }

  res.end();
});

function sendSSE(res: import("express").Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export { router as chatRoutes };
```

**Step 4: Mount chat routes in app.ts**

In `server/src/app.ts`, add import and mount:

```typescript
import { chatRoutes } from "./routes/chat.js";
// ... after existing route mounts:
app.use("/api", chatRoutes);
```

**Step 5: Update test setup to clean new models**

In `server/src/__tests__/setup.ts`, add cleanup for new models:

```typescript
beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
});
```

**Step 6: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: All tests pass including new conversation tests

**Step 7: Commit**

```bash
git add server/src/routes/chat.ts server/src/app.ts server/src/__tests__/chat.test.ts server/src/__tests__/setup.ts
git commit -m "feat: add chat and conversation API routes with SSE streaming"
```

---

### Task 6: Add chat types to client

**Files:**
- Modify: `client/src/lib/types.ts`
- Modify: `client/src/lib/api.ts`

**Step 1: Add types**

Append to `client/src/lib/types.ts`:

```typescript
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
```

**Step 2: Add API functions**

Append to `client/src/lib/api.ts`:

```typescript
// Chat
export const chat = {
  conversations: () => request<Conversation[]>("/conversations"),
  getConversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
};
```

Import the new types at the top of `api.ts`:

```typescript
import type { Project, Task, Tag, Conversation } from "./types";
```

**Step 3: Commit**

```bash
git add client/src/lib/types.ts client/src/lib/api.ts
git commit -m "feat: add chat types and API client functions"
```

---

### Task 7: Build the ChatPanel component

The main chat UI. This is the largest client task.

**Files:**
- Create: `client/src/components/ChatPanel.tsx`

**Step 1: Create the ChatPanel component**

This component manages:
- Conversation list (dropdown in header)
- Message history display (scrollable, auto-scroll)
- Streaming message display (content builds incrementally)
- Tool call cards (inline in message flow)
- Text input with send button

Key state:
```typescript
const [conversations, setConversations] = useState<Conversation[]>([]);
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
const [messages, setMessages] = useState<DisplayMessage[]>([]);
const [input, setInput] = useState("");
const [isStreaming, setIsStreaming] = useState(false);
const [streamingContent, setStreamingContent] = useState("");
const messagesEndRef = useRef<HTMLDivElement>(null);
```

Where `DisplayMessage` is a local type:
```typescript
interface ToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallDisplay[];
}
```

The SSE handler function:
```typescript
async function sendMessage() {
  if (!input.trim() || isStreaming) return;
  const userMsg = input.trim();
  setInput("");
  setMessages(prev => [...prev, { role: "user", content: userMsg }]);
  setIsStreaming(true);
  setStreamingContent("");

  const currentToolCalls: ToolCallDisplay[] = [];

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: activeConversationId,
        message: userMsg,
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          switch (eventType) {
            case "content":
              fullContent += data.delta;
              setStreamingContent(fullContent);
              break;
            case "tool_call":
              currentToolCalls.push({ id: data.id, name: data.name, args: data.args });
              break;
            case "tool_result":
              const tc = currentToolCalls.find(t => t.id === data.id);
              if (tc) {
                tc.result = data.result;
                tc.error = data.error;
              }
              break;
            case "done":
              setActiveConversationId(data.conversationId);
              break;
            case "error":
              fullContent += `\n\nError: ${data.message}`;
              setStreamingContent(fullContent);
              break;
          }
        }
      }
    }

    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content: fullContent,
        toolCalls: currentToolCalls.length > 0 ? [...currentToolCalls] : undefined,
      },
    ]);
  } finally {
    setIsStreaming(false);
    setStreamingContent("");
    onDataChange(); // Trigger main app refresh
  }
}
```

Props:
```typescript
interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
}
```

UI structure (Tailwind):
- Panel: `fixed top-0 right-0 h-full w-[480px] bg-white border-l border-gray-200 shadow-lg flex flex-col z-40`
- Header: flex row with title, new conversation button, close button
- Messages area: `flex-1 overflow-y-auto p-4 space-y-4`
- Each user message: `ml-12 bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2`
- Each assistant message: `mr-12 bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2`
- Tool call cards: `mx-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm` with tool name and a brief result summary
- Input area: `border-t p-4 flex gap-2` with text input and send button

**Step 2: Commit**

```bash
git add client/src/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel component with SSE streaming and tool call display"
```

---

### Task 8: Add ChatBubble FAB and integrate into App layout

**Files:**
- Create: `client/src/components/ChatBubble.tsx`
- Modify: `client/src/components/Layout.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create the ChatBubble FAB**

Create `client/src/components/ChatBubble.tsx`:

```typescript
interface ChatBubbleProps {
  onClick: () => void;
}

export function ChatBubble({ onClick }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      aria-label="Open AI Assistant"
    >
      {/* Chat icon SVG */}
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </button>
  );
}
```

**Step 2: Modify Layout.tsx to accept chat panel state**

Update `Layout.tsx` to add `marginRight` transition when panel is open:

```typescript
interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
  chatOpen?: boolean;
}

export function Layout({ children, activeProjectId, activeView, onSelectProject, onSelectView, chatOpen }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar ... />
      <main
        className="flex-1 overflow-y-auto transition-[margin] duration-300"
        style={{ marginRight: chatOpen ? 480 : 0 }}
      >
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Integrate into App.tsx**

Add chat state and components to `App.tsx`:

```typescript
import { useState, useCallback } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { ChatBubble } from "./components/ChatBubble";

function App() {
  // ... existing state ...
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataChange = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <>
      <Layout ... chatOpen={chatOpen}>
        {/* Pass key={refreshKey} to pages so they re-fetch when AI modifies data */}
        {view === "dashboard" && <Dashboard key={refreshKey} onSelectProject={handleSelectProject} />}
        {view === "project" && activeProjectId && <ProjectView key={refreshKey} projectId={activeProjectId} />}
        {view === "all-tasks" && <AllTasks key={refreshKey} />}
        {view === "due-soon" && <DueSoon key={refreshKey} />}
      </Layout>

      {chatOpen ? (
        <ChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onDataChange={handleDataChange}
        />
      ) : (
        <ChatBubble onClick={() => setChatOpen(true)} />
      )}
    </>
  );
}
```

The `refreshKey` pattern: incrementing the key forces React to unmount and remount the page components, which triggers their `useEffect` data fetches. This is the simplest way to ensure the main UI reflects AI-made changes.

**Step 4: Commit**

```bash
git add client/src/components/ChatBubble.tsx client/src/components/Layout.tsx client/src/App.tsx
git commit -m "feat: add chat bubble FAB and push-aside layout integration"
```

---

### Task 9: End-to-end manual test and Docker rebuild

**Files:**
- Modify: `Dockerfile` (add openai to production deps — should happen automatically since it's a regular dependency)

**Step 1: Run all server tests**

Run: `cd server && npm test`
Expected: All tests pass

**Step 2: Run full build**

Run: `npm run build`
Expected: Both server and client build without errors

**Step 3: Test locally in dev mode**

Run: `npm run dev`

Open http://localhost:5173:
1. Verify the blue chat FAB appears in bottom-right
2. Click it — panel should slide in from right, main content should shrink
3. Type "What projects do I have?" — should stream a response
4. Type "Create a project called Weekend Errands with 3 tasks" — should create project and tasks
5. Verify the dashboard refreshes to show the new project
6. Close and reopen panel — conversation should persist

**Step 4: Docker build and test**

```bash
docker compose up --build
```

Open http://localhost:3001:
- Repeat the same manual tests
- Verify `OPENAI_API_KEY` is passed through (set it in shell before running compose or in `.env` file)

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
```

---

### Task 10: Final commit and cleanup

**Step 1: Verify all tests pass**

Run: `cd server && npm test`

**Step 2: Verify build succeeds**

Run: `npm run build`

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "feat: complete AI assistant with streaming chat, tool calling, and persistent conversations"
```
