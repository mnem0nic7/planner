import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

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
  if (!title) {
    res.status(400).json({ error: "Title is required" });
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
      description,
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
  const { items } = req.body as { items: { id: string; sortOrder: number }[] };
  await prisma.$transaction(
    items.map((item) =>
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
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as taskRoutes };
