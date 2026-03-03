# Tags CRUD UI Design

**Date:** 2026-03-03
**Status:** Approved

## Overview

Add a dedicated Tags management page with full CRUD, usage counts, and sidebar tag filtering to navigate tasks by tag.

## Approach

Tags page for management (create, rename, recolor, delete with usage counts), sidebar tags become clickable to filter tasks by tag.

## Navigation Changes

- View type expands: add `"tags"` and `"tag-tasks"` views
- Sidebar nav: "Tags" button below "Due Soon"
- Sidebar tag badges: clickable, navigate to tag-tasks filtered view
- New state: `activeTagId` in App.tsx
- `onSelectView` extends to accept `"tags"`
- New `onSelectTag(tagId)` callback

## Tags Page (`client/src/pages/TagsPage.tsx`)

- List all tags with color dot, name, task usage count
- "New Tag" button: inline form (name input + color picker)
- Edit: click to toggle inline editing on that row (name + color)
- Delete: with confirmation showing task count ("Delete 'backend'? 5 tasks will be untagged.")
- Calls `tags.list()`, `tags.create()`, `tags.update()`, `tags.delete()` from api.ts

## Tag-Tasks View (`client/src/pages/TagTasks.tsx`)

- Shows tasks filtered by a specific tag
- Header with tag name/color and back button
- Uses existing `TaskRow` component
- Fetches via `GET /api/tasks?tagId=xxx`

## Sidebar Changes

- Add "Tags" nav button (same style as Dashboard/All Tasks/Due Soon)
- Make tag badges in sidebar clickable (change `<span>` to `<button>`)
- Clicking a tag calls `onSelectTag(tagId)`

## Server Changes

1. `GET /api/tags` — include `_count: { select: { tasks: true } }` for usage counts
2. `GET /api/tasks` — add `tagId` query param filter (join through TaskTag)
3. `list_tasks` AI tool — add `tagId` param to tool definition + executor

## Files to Create

- `client/src/pages/TagsPage.tsx` — tag management page
- `client/src/pages/TagTasks.tsx` — filtered task view by tag

## Files to Modify

- `client/src/App.tsx` — new view types, activeTagId state, routing
- `client/src/components/Layout.tsx` — pass new callbacks to Sidebar
- `client/src/components/Sidebar.tsx` — Tags nav button, clickable tag badges, new props
- `server/src/routes/tags.ts` — include task count in GET response
- `server/src/routes/tasks.ts` — tagId filter on GET /api/tasks
- `server/src/ai/tools.ts` — tagId param on list_tasks
- `server/src/ai/toolExecutor.ts` — tagId filter in list_tasks case
