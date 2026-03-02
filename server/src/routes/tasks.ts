import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function isValidDate(value: string): boolean {
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// GET /api/tasks (all tasks across projects)
router.get("/tasks", async (_req, res) => {
  const tasks = await prisma.task.findMany({
    include: { tags: { include: { tag: true } }, project: true },
    orderBy: { createdAt: "desc" },
  });
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
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "Title is required" });
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
      title,
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
    if (!item || typeof item.id !== "string" || typeof item.sortOrder !== "number") {
      res.status(400).json({ error: "Each item must have an id (string) and sortOrder (number)" });
      return;
    }
  }
  await prisma.$transaction(
    items.map((item: { id: string; sortOrder: number }) =>
      prisma.task.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
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
      ...(title !== undefined && { title }),
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
