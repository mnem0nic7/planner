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

  describe("DELETE /api/tasks/:id", () => {
    it("deletes a task", async () => {
      const task = await prisma.task.create({
        data: { title: "Delete me", projectId, sortOrder: 0 },
      });
      const res = await request(app).delete(`/api/tasks/${task.id}`);
      expect(res.status).toBe(204);
    });
  });
});
