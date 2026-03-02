import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

function isValidColor(color: unknown): boolean {
  return typeof color === "string" && COLOR_REGEX.test(color);
}

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
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (color !== undefined && color !== null && !isValidColor(color)) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }
  const project = await prisma.project.create({
    data: { name, description: description || null, color: color || null },
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
  if (color !== undefined && color !== null && !isValidColor(color)) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }

  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

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
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

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
