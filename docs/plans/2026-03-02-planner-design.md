# Planner — Design Document

**Date:** 2026-03-02
**Status:** Approved

## Overview

Personal work planner web app for tracking projects and tasks. Solo use, no authentication. Browser-based UI with a REST API backend and SQLite storage.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via Prisma ORM |
| Structure | npm workspaces monorepo |

## Project Structure

```
planner/
├── client/                  # React SPA (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Top-level views
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities, API client
│   │   └── App.tsx
│   └── package.json
├── server/                  # Express + SQLite API
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── db/              # Prisma schema, seed
│   │   └── index.ts
│   └── package.json
├── package.json             # Root workspace
└── docs/plans/
```

## Data Model

### Project

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String | Required |
| description | String? | Optional markdown |
| color | String? | Hex color for visual distinction |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

### Task

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| title | String | Required |
| description | String? | Markdown notes |
| projectId | String | FK to Project |
| priority | Enum | LOW, MEDIUM, HIGH, URGENT |
| dueDate | DateTime? | Optional deadline |
| completed | Boolean | Default false |
| completedAt | DateTime? | Set when completed |
| sortOrder | Int | For drag-and-drop reordering |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

### Tag

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String | Unique |
| color | String? | Hex color |

### TaskTag (join table)

| Field | Type | Notes |
|-------|------|-------|
| taskId | String | FK to Task |
| tagId | String | FK to Tag |

## API Endpoints

### Projects

- `GET /api/projects` — List all projects
- `POST /api/projects` — Create a project
- `GET /api/projects/:id` — Get project with its tasks
- `PATCH /api/projects/:id` — Update a project
- `DELETE /api/projects/:id` — Delete project (cascades tasks)

### Tasks

- `GET /api/projects/:id/tasks` — List tasks for a project
- `POST /api/projects/:id/tasks` — Create task in a project
- `PATCH /api/tasks/:id` — Update a task
- `DELETE /api/tasks/:id` — Delete a task
- `PATCH /api/tasks/:id/complete` — Toggle task completion
- `PATCH /api/tasks/reorder` — Batch update sortOrder

### Tags

- `GET /api/tags` — List all tags
- `POST /api/tags` — Create a tag
- `DELETE /api/tags/:id` — Delete a tag
- `POST /api/tasks/:id/tags` — Add tag to task
- `DELETE /api/tasks/:id/tags/:tagId` — Remove tag from task

## UI Pages

1. **Dashboard** — All projects as cards with task counts and progress bars. Quick-add project button.
2. **Project View** — Task list with checkboxes, priority badges, due dates, tags. Drag to reorder. Inline editing, click to expand for full notes.
3. **Sidebar** — Persistent left navigation:
   - Project list
   - Tag filter
   - "All Tasks" cross-project view
   - "Due Soon" view (tasks due within 7 days)

## Error Handling

- API returns `{ error: string, status: number }` on failure
- Client shows toast notifications for errors
- Delete project prompts confirmation, cascades to tasks
- Empty states with helpful messages

## Decisions

- **No auth** — solo tool, unnecessary complexity
- **Prisma** over Drizzle — better migration tooling, auto-generated types
- **Tailwind CSS** — fast to build, consistent styling
- **SQLite** — zero setup, single-file database, easy backups
- **npm workspaces** — single install, shared TypeScript config
