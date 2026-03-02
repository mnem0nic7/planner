# AI Assistant Design

## Overview

A full autonomous AI assistant integrated into the planner app. Uses OpenAI's gpt-4o with function calling to manage projects, tasks, and tags through natural language. Streams responses via SSE for real-time UX.

## Architecture

**Server-side streaming agent.** The Express server handles the OpenAI conversation loop, executes tool calls against Prisma, and streams responses to the client via Server-Sent Events.

### Flow

1. Client sends user message via `POST /api/chat`
2. Server loads conversation history from DB
3. Server calls OpenAI with system prompt + tools + history
4. OpenAI streams response — either text or tool calls
5. Server executes tool calls against Prisma, feeds results back
6. Server streams content deltas, tool call events, and results to client via SSE
7. Server saves all messages to DB
8. Client renders incrementally and refreshes main app on data changes

## Data Model

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
  role           String       // "user" | "assistant" | "tool"
  content        String?
  toolCalls      String?      // JSON-serialized OpenAI tool calls
  toolCallId     String?      // For tool result messages
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  conversationId String
}
```

## Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_projects` | List all projects with task counts | none |
| `get_project` | Get project details with all tasks | projectId |
| `create_project` | Create a new project | name, description?, color? |
| `update_project` | Update project fields | projectId, name?, description?, color? |
| `delete_project` | Delete a project | projectId |
| `list_tasks` | List tasks (optionally filtered) | projectId?, completed?, priority? |
| `create_task` | Create a task in a project | projectId, title, description?, priority?, dueDate? |
| `update_task` | Update task fields | taskId, title?, description?, priority?, dueDate? |
| `complete_task` | Toggle task completion | taskId |
| `delete_task` | Delete a task | taskId |
| `list_tags` | List all tags | none |
| `create_tag` | Create a tag | name, color? |
| `add_tag_to_task` | Tag a task | taskId, tagId |
| `remove_tag_from_task` | Untag a task | taskId, tagId |
| `get_due_soon` | Get tasks due within N days | days? (default 7) |
| `get_workload_summary` | Stats: total, completed, overdue, by priority | none |

## API Endpoints

```
POST   /api/chat                    Stream chat response (SSE)
GET    /api/conversations           List conversations
GET    /api/conversations/:id       Get conversation with messages
DELETE /api/conversations/:id       Delete conversation
```

### SSE Event Types

```
event: content      data: {"delta": "text chunk"}
event: tool_call    data: {"name": "create_project", "args": {...}}
event: tool_result  data: {"name": "create_project", "result": {...}}
event: done         data: {"conversationId": "...", "messageId": "..."}
event: error        data: {"message": "..."}
```

## UI Design

### Floating Action Button + Side Panel

- FAB in bottom-right corner when panel is closed
- Full-height side panel (480px wide) that pushes main content aside
- Smooth CSS transition when opening/closing

### Components

- **ChatBubble** — FAB button with open/close toggle
- **ChatPanel** — Full-height side panel with header, message list, input
- **ChatMessageList** — Scrollable message history with auto-scroll
- **ChatMessage** — User or assistant message bubble
- **ToolCallCard** — Inline card showing tool execution and result
- **ChatInput** — Text input with send button, disabled during streaming

### Data Sync

When the AI modifies data (creates/edits/deletes), the ChatBubble component calls an `onDataChange` callback passed from App.tsx. This triggers a re-fetch of the current view's data so the UI stays in sync.

## Configuration

- `OPENAI_API_KEY` — Server environment variable, never exposed to client
- Model: `gpt-4o` (hardcoded, easy to make configurable)
- Added to `docker-compose.yml` as env var

## System Prompt

The assistant receives a system prompt that:
- Identifies it as the planner's AI assistant
- Provides the current date/time
- Instructs it to be concise and action-oriented
- Tells it to use tools proactively (act, don't just describe)
- Includes guidance for proactive suggestions (deadlines, priorities, workload)
