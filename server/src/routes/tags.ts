import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_NAME_LENGTH = 100;

// GET /api/tags
router.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  res.json(tags);
});

// POST /api/tags
router.post("/", async (req, res) => {
  const { name, color } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `Name must be under ${MAX_NAME_LENGTH} characters` });
    return;
  }

  if (color !== undefined && color !== null && (typeof color !== "string" || !COLOR_REGEX.test(color))) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }

  const trimmedName = name.trim();
  const existing = await prisma.tag.findUnique({ where: { name: trimmedName } });
  if (existing) {
    res.status(409).json({ error: "Tag already exists" });
    return;
  }

  const tag = await prisma.tag.create({ data: { name: trimmedName, color: color || null } });
  res.status(201).json(tag);
});

// PATCH /api/tags/:id
router.patch("/:id", async (req, res) => {
  const { name, color } = req.body;

  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Name must be a non-empty string" });
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be under ${MAX_NAME_LENGTH} characters` });
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName !== existing.name) {
      const duplicate = await prisma.tag.findUnique({ where: { name: trimmedName } });
      if (duplicate) {
        res.status(409).json({ error: "Tag name already exists" });
        return;
      }
    }
  }

  if (color !== undefined && color !== null && (typeof color !== "string" || !COLOR_REGEX.test(color))) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }

  const tag = await prisma.tag.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(color !== undefined && { color: color || null }),
    },
  });
  res.json(tag);
});

// DELETE /api/tags/:id
router.delete("/:id", async (req, res) => {
  const existing = await prisma.tag.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  await prisma.tag.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as tagRoutes };
