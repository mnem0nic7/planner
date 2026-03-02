import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Tags API", () => {
  describe("GET /api/tags", () => {
    it("returns all tags", async () => {
      await prisma.tag.create({ data: { name: "work", color: "#3b82f6" } });
      const res = await request(app).get("/api/tags");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("work");
    });
  });

  describe("POST /api/tags", () => {
    it("creates a tag", async () => {
      const res = await request(app)
        .post("/api/tags")
        .send({ name: "urgent", color: "#ef4444" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("urgent");
    });

    it("rejects duplicate tag name", async () => {
      await prisma.tag.create({ data: { name: "dupe" } });
      const res = await request(app)
        .post("/api/tags")
        .send({ name: "dupe" });
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("deletes a tag", async () => {
      const tag = await prisma.tag.create({ data: { name: "delete-me" } });
      const res = await request(app).delete(`/api/tags/${tag.id}`);
      expect(res.status).toBe(204);
    });
  });

  describe("Task-Tag association", () => {
    let taskId: string;
    let tagId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({ data: { name: "P" } });
      const task = await prisma.task.create({
        data: { title: "T", projectId: project.id, sortOrder: 0 },
      });
      const tag = await prisma.tag.create({ data: { name: "label" } });
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
