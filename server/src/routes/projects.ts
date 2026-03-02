import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

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
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `Name must be under ${MAX_NAME_LENGTH} characters` });
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
  if (color !== undefined && color !== null && !isValidColor(color)) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }
  const project = await prisma.project.create({
    data: { name: name.trim(), description: description || null, color: color || null },
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
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "Name must be a non-empty string" });
    return;
  }
  if (typeof name === "string" && name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `Name must be under ${MAX_NAME_LENGTH} characters` });
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
      ...(name !== undefined && { name: (name as string).trim() }),
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
