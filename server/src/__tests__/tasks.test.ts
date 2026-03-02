import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Tasks API", () => {
  let projectId: string;

  beforeEach(async () => {
    const project = await prisma.project.create({ data: { name: "Test" } });
    projectId = project.id;
  });

  describe("GET /api/projects/:id/tasks", () => {
    it("returns tasks for a project sorted by sortOrder", async () => {
      await prisma.task.createMany({
        data: [
          { title: "Second", projectId, sortOrder: 1 },
          { title: "First", projectId, sortOrder: 0 },
        ],
      });
      const res = await request(app).get(`/api/projects/${projectId}/tasks`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("First");
      expect(res.body[1].title).toBe("Second");
    });
  });

  describe("POST /api/projects/:id/tasks", () => {
    it("creates a task in a project", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "New Task", priority: "HIGH" });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("New Task");
      expect(res.body.priority).toBe("HIGH");
      expect(res.body.projectId).toBe(projectId);
    });

    it("rejects task without title", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("auto-sets sortOrder to end of list", async () => {
      await prisma.task.create({
        data: { title: "Existing", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "New" });
      expect(res.body.sortOrder).toBe(1);
    });
  });

  describe("PATCH /api/tasks/:id", () => {
    it("updates task fields", async () => {
      const task = await prisma.task.create({
        data: { title: "Old", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .send({ title: "New", priority: "URGENT", description: "# Notes" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("New");
      expect(res.body.priority).toBe("URGENT");
      expect(res.body.description).toBe("# Notes");
    });
  });

  describe("PATCH /api/tasks/:id/complete", () => {
    it("toggles completion on", async () => {
      const task = await prisma.task.create({
        data: { title: "Do it", projectId, sortOrder: 0 },
      });
      const res = await request(app).patch(`/api/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).toBeDefined();
    });

    it("toggles completion off", async () => {
      const task = await prisma.task.create({
        data: {
          title: "Done",
          projectId,
          sortOrder: 0,
          completed: true,
          completedAt: new Date(),
        },
      });
      const res = await request(app).patch(`/api/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });
  });

  describe("PATCH /api/tasks/reorder", () => {
    it("batch updates sort order", async () => {
      const t1 = await prisma.task.create({
        data: { title: "A", projectId, sortOrder: 0 },
      });
      const t2 = await prisma.task.create({
        data: { title: "B", projectId, sortOrder: 1 },
      });
      const res = await request(app)
        .patch("/api/tasks/reorder")
        .send({
          items: [
            { id: t1.id, sortOrder: 1 },
            { id: t2.id, sortOrder: 0 },
          ],
        });
      expect(res.status).toBe(200);

      const tasks = await prisma.task.findMany({
        where: { projectId },
        orderBy: { sortOrder: "asc" },
      });
      expect(tasks[0].title).toBe("B");
      expect(tasks[1].title).toBe("A");
    });
  });

  describe("PATCH /api/tasks/reorder error handling", () => {
    it("returns 404 when a task ID is invalid", async () => {
      const t1 = await prisma.task.create({
        data: { title: "A", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .patch("/api/tasks/reorder")
        .send({
          items: [
            { id: t1.id, sortOrder: 1 },
            { id: "nonexistent", sortOrder: 0 },
          ],
        });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("deletes a task", async () => {
      const task = await prisma.task.create({
        data: { title: "Delete me", projectId, sortOrder: 0 },
      });
      const res = await request(app).delete(`/api/tasks/${task.id}`);
      expect(res.status).toBe(204);
    });
  });

  describe("GET /api/tasks", () => {
    it("returns all tasks across projects", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      await prisma.task.create({ data: { title: "T", projectId: p.id, sortOrder: 0 } });
      const res = await request(app).get("/api/tasks");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("POST /api/projects/:id/tasks validation", () => {
    it("returns 404 for nonexistent project", async () => {
      const res = await request(app)
        .post("/api/projects/nonexistent/tasks")
        .send({ title: "Orphan" });
      expect(res.status).toBe(404);
    });

    it("rejects invalid priority", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "T", priority: "SUPER" });
      expect(res.status).toBe(400);
    });

    it("rejects invalid due date", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "T", dueDate: "not-a-date" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/projects/:id/tasks string validation", () => {
    it("rejects whitespace-only title", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "   " });
      expect(res.status).toBe(400);
    });

    it("rejects oversized title", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "x".repeat(501) });
      expect(res.status).toBe(400);
    });

    it("trims title whitespace", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "  My Task  " });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("My Task");
    });
  });

  describe("POST /api/tasks/:id/tags entity validation", () => {
    it("returns 404 when task does not exist", async () => {
      const tag = await prisma.tag.create({ data: { name: "orphan-tag" } });
      const res = await request(app)
        .post("/api/tasks/nonexistent/tags")
        .send({ tagId: tag.id });
      expect(res.status).toBe(404);
    });

    it("returns 404 when tag does not exist", async () => {
      const task = await prisma.task.create({
        data: { title: "T", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .send({ tagId: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/tasks/:id/tags duplicate check", () => {
    it("returns 409 when adding duplicate tag", async () => {
      const task = await prisma.task.create({
        data: { title: "T", projectId, sortOrder: 0 },
      });
      const tag = await prisma.tag.create({ data: { name: "dup-test" } });
      await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } });
      const res = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .send({ tagId: tag.id });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/tasks/due-soon", () => {
    it("returns tasks due within 7 days", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await prisma.task.create({
        data: { title: "Soon", projectId: p.id, sortOrder: 0, dueDate: tomorrow },
      });
      const res = await request(app).get("/api/tasks/due-soon");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("excludes completed tasks", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await prisma.task.create({
        data: { title: "Done", projectId: p.id, sortOrder: 0, dueDate: tomorrow, completed: true },
      });
      const res = await request(app).get("/api/tasks/due-soon");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });
});
