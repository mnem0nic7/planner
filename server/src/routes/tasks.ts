import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_BULK_IDS = 50;

function validateTaskIds(taskIds: unknown): string[] | null {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return null;
  if (taskIds.length > MAX_BULK_IDS) return null;
  if (!taskIds.every(id => typeof id === "string" && id.trim().length > 0 && id.length < 100)) return null;
  return taskIds as string[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;
function isValidDate(value: string): boolean {
  return typeof value === "string" && ISO_DATE_RE.test(value) && !isNaN(new Date(value).getTime());
}

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

  // Filter: tagId (tasks that have this tag via TaskTag join)
  if (req.query.tagId && typeof req.query.tagId === "string") {
    where.tags = { some: { tagId: req.query.tagId } };
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
  const sortBy = req.query.sortBy && typeof req.query.sortBy === "string" && VALID_SORT_FIELDS.includes(req.query.sortBy)
    ? req.query.sortBy : null;
  const sortDir = req.query.sortOrder === "desc" ? "desc" : "asc";

  // Priority sorts by ordinal (LOW=0, MEDIUM=1, HIGH=2, URGENT=3) in application code
  const orderBy: Record<string, string> = sortBy && sortBy !== "priority"
    ? { [sortBy]: sortDir }
    : { createdAt: "desc" };

  const tasks = await prisma.task.findMany({
    where,
    include: { tags: { include: { tag: true } }, project: true },
    orderBy,
  });

  // Application-level sort for priority (alphabetical DB sort doesn't match severity)
  if (sortBy === "priority") {
    const priorityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
    tasks.sort((a, b) => {
      const diff = (priorityOrder[a.priority] ?? 0) - (priorityOrder[b.priority] ?? 0);
      return sortDir === "desc" ? -diff : diff;
    });
  }

  res.json(tasks);
});

// GET /api/tasks/due-soon
router.get("/tasks/due-soon", async (_req, res) => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      dueDate: { lte: nextWeek, not: null },
    },
    include: { tags: { include: { tag: true } }, project: true },
    orderBy: { dueDate: "asc" },
  });
  res.json(tasks);
});

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

// GET /api/projects/:id/tasks
router.get("/projects/:id/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: { tags: { include: { tag: true } } },
    orderBy: { sortOrder: "asc" },
  });
  res.json(tasks);
});

// POST /api/projects/:id/tasks
router.post("/projects/:id/tasks", async (req, res) => {
  const { title, description, priority, dueDate } = req.body;
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `Title must be under ${MAX_TITLE_LENGTH} characters` });
    return;
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    res.status(400).json({ error: "Description must be a string" });
    return;
  }
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) {
    res.status(400).json({ error: `Description must be under ${MAX_DESCRIPTION_LENGTH} characters` });
    return;
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    return;
  }
  if (dueDate && !isValidDate(dueDate)) {
    res.status(400).json({ error: "Invalid due date" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Auto-set sortOrder to end of list
  const maxSort = await prisma.task.aggregate({
    where: { projectId: req.params.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder,
      projectId: req.params.id,
    },
    include: { tags: { include: { tag: true } } },
  });
  res.status(201).json(task);
});

// PATCH /api/tasks/reorder — MUST be before /tasks/:id to avoid "reorder" matching as :id
router.patch("/tasks/reorder", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Items array is required" });
    return;
  }
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !item.id.trim() || item.id.length > 100
        || typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      res.status(400).json({ error: "Each item must have an id (string) and sortOrder (non-negative integer)" });
      return;
    }
  }
  try {
    await prisma.$transaction(
      items.map((item: { id: string; sortOrder: number }) =>
        prisma.task.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
  } catch (err: unknown) {
    const prismaError = err as { code?: string };
    if (prismaError.code === "P2025") {
      res.status(404).json({ error: "One or more task IDs not found" });
      return;
    }
    throw err;
  }
  res.json({ success: true });
});

// PATCH /api/tasks/:id/complete
router.patch("/tasks/:id/complete", async (req, res) => {
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      completed: !existing.completed,
      completedAt: existing.completed ? null : new Date(),
    },
    include: { tags: { include: { tag: true } } },
  });
  res.json(task);
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const { title, description, priority, dueDate } = req.body;
  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ error: "Title must be a non-empty string" });
    return;
  }
  if (typeof title === "string" && title.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `Title must be under ${MAX_TITLE_LENGTH} characters` });
    return;
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    res.status(400).json({ error: "Description must be a string" });
    return;
  }
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) {
    res.status(400).json({ error: `Description must be under ${MAX_DESCRIPTION_LENGTH} characters` });
    return;
  }
  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    return;
  }
  if (dueDate !== undefined && dueDate !== null && !isValidDate(dueDate)) {
    res.status(400).json({ error: "Invalid due date" });
    return;
  }

  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined && { title: (title as string).trim() }),
      ...(description !== undefined && { description }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: { tags: { include: { tag: true } } },
  });
  res.json(task);
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /api/tasks/:id/tags
router.post("/tasks/:id/tags", async (req, res) => {
  const { tagId } = req.body;
  if (!tagId || typeof tagId !== "string") {
    res.status(400).json({ error: "tagId is required" });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  const existing = await prisma.taskTag.findUnique({
    where: { taskId_tagId: { taskId: req.params.id, tagId } },
  });
  if (existing) {
    res.status(409).json({ error: "Tag already on task" });
    return;
  }

  await prisma.taskTag.create({
    data: { taskId: req.params.id, tagId },
  });
  res.status(201).json({ success: true });
});

// DELETE /api/tasks/:id/tags/:tagId
router.delete("/tasks/:id/tags/:tagId", async (req, res) => {
  const existing = await prisma.taskTag.findUnique({
    where: { taskId_tagId: { taskId: req.params.id, tagId: req.params.tagId } },
  });
  if (!existing) {
    res.status(404).json({ error: "Tag not on task" });
    return;
  }
  await prisma.taskTag.delete({
    where: { taskId_tagId: { taskId: req.params.id, tagId: req.params.tagId } },
  });
  res.status(204).send();
});

export { router as taskRoutes };
