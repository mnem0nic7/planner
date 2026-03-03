import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Tags API", () => {
  describe("GET /api/tags", () => {
    it("returns created tag", async () => {
      const tag = await prisma.tag.create({ data: { name: `work-${Date.now()}`, color: "#3b82f6" } });
      const res = await request(app).get("/api/tags");
      expect(res.status).toBe(200);
      const found = res.body.find((t: { id: string }) => t.id === tag.id);
      expect(found).toBeDefined();
      expect(found.color).toBe("#3b82f6");
    });
  });

  describe("POST /api/tags", () => {
    it("creates a tag", async () => {
      const name = `urgent-${Date.now()}`;
      const res = await request(app)
        .post("/api/tags")
        .send({ name, color: "#ef4444" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(name);
      expect(res.body.color).toBe("#ef4444");
    });

    it("rejects invalid color", async () => {
      const res = await request(app)
        .post("/api/tags")
        .send({ name: "bad-color", color: "not-a-color" });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate tag name", async () => {
      const name = `dupe-${Date.now()}`;
      await prisma.tag.create({ data: { name } });
      const res = await request(app)
        .post("/api/tags")
        .send({ name });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/tags validation", () => {
    it("rejects whitespace-only name", async () => {
      const res = await request(app).post("/api/tags").send({ name: "   " });
      expect(res.status).toBe(400);
    });

    it("rejects non-string name", async () => {
      const res = await request(app).post("/api/tags").send({ name: 42 });
      expect(res.status).toBe(400);
    });

    it("rejects oversized name", async () => {
      const res = await request(app).post("/api/tags").send({ name: "x".repeat(101) });
      expect(res.status).toBe(400);
    });

    it("trims name whitespace", async () => {
      const res = await request(app).post("/api/tags").send({ name: "  trimmed  " });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("trimmed");
    });
  });

  describe("PATCH /api/tags/:id", () => {
    it("updates tag name", async () => {
      const tag = await prisma.tag.create({ data: { name: `old-${Date.now()}`, color: "#ff0000" } });
      const newName = `new-${Date.now()}`;
      const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: newName });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(newName);
      expect(res.body.color).toBe("#ff0000");
    });

    it("updates tag color", async () => {
      const tag = await prisma.tag.create({ data: { name: `color-${Date.now()}` } });
      const res = await request(app).patch(`/api/tags/${tag.id}`).send({ color: "#00ff00" });
      expect(res.status).toBe(200);
      expect(res.body.color).toBe("#00ff00");
    });

    it("returns 404 for non-existent tag", async () => {
      const res = await request(app).patch("/api/tags/nonexistent").send({ name: "nope" });
      expect(res.status).toBe(404);
    });

    it("returns 409 for duplicate name", async () => {
      const existing = await prisma.tag.create({ data: { name: `dup-${Date.now()}` } });
      const tag = await prisma.tag.create({ data: { name: `other-${Date.now()}` } });
      const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: existing.name });
      expect(res.status).toBe(409);
    });

    it("rejects invalid color", async () => {
      const tag = await prisma.tag.create({ data: { name: `badcolor-${Date.now()}` } });
      const res = await request(app).patch(`/api/tags/${tag.id}`).send({ color: "not-a-color" });
      expect(res.status).toBe(400);
    });

    it("rejects empty name", async () => {
      const tag = await prisma.tag.create({ data: { name: `emptyname-${Date.now()}` } });
      const res = await request(app).patch(`/api/tags/${tag.id}`).send({ name: "   " });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("deletes a tag", async () => {
      const tag = await prisma.tag.create({ data: { name: "delete-me" } });
      const res = await request(app).delete(`/api/tags/${tag.id}`);
      expect(res.status).toBe(204);
    });

    it("returns 404 for nonexistent tag", async () => {
      const res = await request(app).delete("/api/tags/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("update_tag AI tool", () => {
    it("updates tag via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const tag = await prisma.tag.create({ data: { name: `ai-tag-${Date.now()}`, color: "#111111" } });
      const result = await executeTool("update_tag", { tagId: tag.id, name: `updated-${Date.now()}`, color: "#222222" });
      expect(result).toHaveProperty("name");
      expect((result as { color: string }).color).toBe("#222222");
    });
  });

  describe("Task-Tag association", () => {
    let taskId: string;
    let tagId: string;

    beforeEach(async () => {
      const suffix = Math.random().toString(36).slice(2, 8);
      const project = await prisma.project.create({ data: { name: `P-${suffix}` } });
      const task = await prisma.task.create({
        data: { title: "T", projectId: project.id, sortOrder: 0 },
      });
      const tag = await prisma.tag.create({ data: { name: `label-${suffix}` } });
      taskId = task.id;
      tagId = tag.id;
    });

    it("adds a tag to a task", async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/tags`)
        .send({ tagId });
      expect(res.status).toBe(201);
    });

    it("removes a tag from a task", async () => {
      await prisma.taskTag.create({ data: { taskId, tagId } });
      const res = await request(app).delete(
        `/api/tasks/${taskId}/tags/${tagId}`
      );
      expect(res.status).toBe(204);
    });
  });
});
