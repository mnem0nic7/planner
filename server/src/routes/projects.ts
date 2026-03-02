import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// GET /api/projects
router.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
});

// POST /api/projects
router.post("/", async (req, res) => {
  const { name, description, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const project = await prisma.project.create({
    data: { name, description, color },
  });
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        include: { tags: { include: { tag: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PATCH /api/projects/:id
router.patch("/:id", async (req, res) => {
  const { name, description, color } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
    },
  });
  res.json(project);
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  await prisma.$transaction([
    prisma.taskTag.deleteMany({
      where: { task: { projectId: req.params.id } },
    }),
    prisma.task.deleteMany({ where: { projectId: req.params.id } }),
    prisma.project.delete({ where: { id: req.params.id } }),
  ]);
  res.status(204).send();
});

export { router as projectRoutes };
