import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

const COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

// GET /api/tags
router.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  res.json(tags);
});

// POST /api/tags
router.post("/", async (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  if (color !== undefined && color !== null && (typeof color !== "string" || !COLOR_REGEX.test(color))) {
    res.status(400).json({ error: "Color must be a valid hex color (e.g. #FF5733)" });
    return;
  }

  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: "Tag already exists" });
    return;
  }

  const tag = await prisma.tag.create({ data: { name, color: color || null } });
  res.status(201).json(tag);
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
