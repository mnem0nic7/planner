# AI Project Context Awareness + CRUD Improvements

**Date:** 2026-03-03
**Status:** Approved

## Overview

Two improvements to the planner app:
1. **AI project context awareness** — The AI assistant gets full context about the currently open project via system prompt injection.
2. **CRUD improvements** — Tag updates, task filtering/sorting, and bulk operations, with full AI tool parity.

## Feature 1: AI Project Context Awareness

### Approach: System Prompt Injection

When the client sends a chat message, it includes `activeProjectId`. The server fetches that project (with tasks + tags) and injects a context block into the system prompt.

### Data Flow

1. `ChatPanel` receives `activeProjectId` prop from `App.tsx`
2. `POST /api/chat` body includes optional `activeProjectId`
3. Chat route fetches project with tasks and tags (if `activeProjectId` provided)
4. Agent receives project context string, injects into system prompt
5. AI naturally understands "this project" and defaults new tasks there

### System Prompt Context Block

Appended to existing system prompt when a project is active:

```
--- Current Project Context ---
The user is currently viewing project "{name}" (ID: {id}).
Description: {description or "None"}
Status: {pending} pending, {completed} completed, {overdue} overdue tasks.

Tasks:
- [ ] Task title (HIGH, due 2026-03-05) [tags: backend, urgent]
- [x] Completed task (LOW)
...

Default new tasks to this project unless the user specifies otherwise.
When discussing "this project" or "here", refer to this project.
```

### Token Budget

~10 tokens per task. 50 tasks = ~500 extra tokens. No summarization needed until 200+ tasks.

### Changes Required

- `client/src/components/ChatPanel.tsx` — Accept `activeProjectId` prop, send in fetch body
- `client/src/App.tsx` — Pass `activeProjectId` to ChatPanel
- `server/src/routes/chat.ts` — Accept optional `activeProjectId`, fetch project data, build context
- `server/src/ai/agent.ts` — Accept project context string, inject into system prompt

## Feature 2: CRUD Improvements

### 2a. Tag Updates

**Endpoint:** `PATCH /api/tags/:id`
- Body: `{ name?, color? }` — partial update
- Name uniqueness enforced (409 on conflict)
- Validation: name max 100 chars, color hex regex

**AI Tool:** `update_tag` — params: `tagId` (required), `name` (optional), `color` (optional)

### 2b. Task Filtering & Sorting

**Enhanced endpoint:** `GET /api/tasks` with query params:

| Param | Type | Description |
|---|---|---|
| `projectId` | string | Filter to one project |
| `completed` | `true`/`false` | Filter by completion |
| `priority` | `LOW,MEDIUM,HIGH,URGENT` | Comma-separated list |
| `dueBefore` | ISO date | Tasks due before date |
| `dueAfter` | ISO date | Tasks due after date |
| `sortBy` | `dueDate`, `priority`, `createdAt`, `title` | Sort field |
| `sortOrder` | `asc`, `desc` | Sort direction (default `asc`) |

**AI Tool:** Enhanced `list_tasks` — adds matching optional params to existing tool definition.

### 2c. Bulk Operations

| Endpoint | Method | Body | Behavior |
|---|---|---|---|
| `/api/tasks/bulk-complete` | PATCH | `{ taskIds: string[], completed: boolean }` | Set completion on all |
| `/api/tasks/bulk-delete` | POST | `{ taskIds: string[] }` | Delete all specified |
| `/api/tasks/bulk-move` | PATCH | `{ taskIds: string[], projectId: string }` | Move to target project |

All use `prisma.$transaction`. Max 50 task IDs per request.

**AI Tools:** `bulk_complete_tasks`, `bulk_delete_tasks`, `bulk_move_tasks`

### Validation Rules

- Bulk endpoints: `taskIds` non-empty array, max 50, valid strings
- Tag update: name max 100 chars, color hex regex
- Filter params: validated server-side, invalid values ignored
- `bulk-delete` uses POST to allow request body

## AI Tool Summary

| Existing Tool | Change |
|---|---|
| `list_tasks` | Add filter/sort params |

| New Tool | Params |
|---|---|
| `update_tag` | tagId, name?, color? |
| `bulk_complete_tasks` | taskIds[], completed |
| `bulk_delete_tasks` | taskIds[] |
| `bulk_move_tasks` | taskIds[], projectId |
