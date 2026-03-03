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

    it("returns 404 for nonexistent task", async () => {
      const res = await request(app).patch("/api/tasks/nonexistent").send({ title: "X" });
      expect(res.status).toBe(404);
    });

    it("rejects invalid priority", async () => {
      const task = await prisma.task.create({ data: { title: "T", projectId, sortOrder: 0 } });
      const res = await request(app).patch(`/api/tasks/${task.id}`).send({ priority: "SUPER" });
      expect(res.status).toBe(400);
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

    it("returns 404 for nonexistent task", async () => {
      const res = await request(app).delete("/api/tasks/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/tasks", () => {
    it("returns tasks including newly created one", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      const task = await prisma.task.create({ data: { title: "Unique-AllTasks", projectId: p.id, sortOrder: 0 } });
      const res = await request(app).get("/api/tasks");
      expect(res.status).toBe(200);
      const found = res.body.find((t: { id: string }) => t.id === task.id);
      expect(found).toBeDefined();
      expect(found.title).toBe("Unique-AllTasks");
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
      const tag = await prisma.tag.create({ data: { name: `orphan-${Date.now()}` } });
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
      const tag = await prisma.tag.create({ data: { name: `dup-${Date.now()}` } });
      await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } });
      const res = await request(app)
        .post(`/api/tasks/${task.id}/tags`)
        .send({ tagId: tag.id });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/tasks (filtering & sorting)", () => {
    let filterProjectId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({ data: { name: `filter-${Date.now()}` } });
      filterProjectId = project.id;
      await prisma.task.createMany({
        data: [
          { title: "A-Low", priority: "LOW", completed: false, sortOrder: 0, projectId: filterProjectId, dueDate: new Date("2026-03-10") },
          { title: "B-High", priority: "HIGH", completed: false, sortOrder: 1, projectId: filterProjectId, dueDate: new Date("2026-03-05") },
          { title: "C-Done", priority: "MEDIUM", completed: true, completedAt: new Date(), sortOrder: 2, projectId: filterProjectId },
        ],
      });
    });

    it("filters by projectId", async () => {
      const res = await request(app).get(`/api/tasks?projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
    });

    it("filters by completed=false", async () => {
      const res = await request(app).get(`/api/tasks?completed=false&projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((t: { completed: boolean }) => !t.completed)).toBe(true);
    });

    it("filters by priority", async () => {
      const res = await request(app).get(`/api/tasks?priority=HIGH&projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((t: { priority: string }) => t.priority === "HIGH")).toBe(true);
    });

    it("filters by dueBefore", async () => {
      const res = await request(app).get(`/api/tasks?dueBefore=2026-03-08&projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.some((t: { title: string }) => t.title === "B-High")).toBe(true);
    });

    it("sorts by priority desc", async () => {
      const res = await request(app).get(`/api/tasks?sortBy=priority&sortOrder=desc&projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
      const priorities = res.body.map((t: { priority: string }) => t.priority);
      expect(priorities.indexOf("HIGH")).toBeLessThan(priorities.indexOf("LOW"));
    });

    it("sorts by dueDate asc", async () => {
      const res = await request(app).get(`/api/tasks?sortBy=dueDate&sortOrder=asc&projectId=${filterProjectId}`);
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/tasks/due-soon", () => {
    it("returns tasks due within 7 days", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const task = await prisma.task.create({
        data: { title: "Soon-Due", projectId: p.id, sortOrder: 0, dueDate: tomorrow },
      });
      const res = await request(app).get("/api/tasks/due-soon");
      expect(res.status).toBe(200);
      const found = res.body.find((t: { id: string }) => t.id === task.id);
      expect(found).toBeDefined();
    });

    it("excludes completed tasks", async () => {
      const p = await prisma.project.create({ data: { name: "P" } });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const task = await prisma.task.create({
        data: { title: "Done-Due", projectId: p.id, sortOrder: 0, dueDate: tomorrow, completed: true },
      });
      const res = await request(app).get("/api/tasks/due-soon");
      expect(res.status).toBe(200);
      const found = res.body.find((t: { id: string }) => t.id === task.id);
      expect(found).toBeUndefined();
    });
  });

  describe("PATCH /api/tasks/bulk-complete", () => {
    it("bulk completes multiple tasks", async () => {
      const project = await prisma.project.create({ data: { name: `bulk-${Date.now()}` } });
      const t1 = await prisma.task.create({ data: { title: "T1", projectId: project.id, sortOrder: 0 } });
      const t2 = await prisma.task.create({ data: { title: "T2", projectId: project.id, sortOrder: 1 } });
      const res = await request(app)
        .patch("/api/tasks/bulk-complete")
        .send({ taskIds: [t1.id, t2.id], completed: true });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      const updated = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
      expect(updated.every(t => t.completed)).toBe(true);
    });

    it("bulk uncompletes tasks", async () => {
      const project = await prisma.project.create({ data: { name: `bulkun-${Date.now()}` } });
      const t = await prisma.task.create({
        data: { title: "Done", projectId: project.id, sortOrder: 0, completed: true, completedAt: new Date() },
      });
      const res = await request(app)
        .patch("/api/tasks/bulk-complete")
        .send({ taskIds: [t.id], completed: false });
      expect(res.status).toBe(200);
      const updated = await prisma.task.findUnique({ where: { id: t.id } });
      expect(updated!.completed).toBe(false);
      expect(updated!.completedAt).toBeNull();
    });

    it("rejects empty taskIds array", async () => {
      const res = await request(app).patch("/api/tasks/bulk-complete").send({ taskIds: [], completed: true });
      expect(res.status).toBe(400);
    });

    it("rejects more than 50 taskIds", async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`);
      const res = await request(app).patch("/api/tasks/bulk-complete").send({ taskIds: ids, completed: true });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/tasks/bulk-delete", () => {
    it("deletes multiple tasks", async () => {
      const project = await prisma.project.create({ data: { name: `bulkdel-${Date.now()}` } });
      const t1 = await prisma.task.create({ data: { title: "Del1", projectId: project.id, sortOrder: 0 } });
      const t2 = await prisma.task.create({ data: { title: "Del2", projectId: project.id, sortOrder: 1 } });
      const res = await request(app)
        .post("/api/tasks/bulk-delete")
        .send({ taskIds: [t1.id, t2.id] });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      const remaining = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
      expect(remaining).toHaveLength(0);
    });

    it("rejects empty taskIds", async () => {
      const res = await request(app).post("/api/tasks/bulk-delete").send({ taskIds: [] });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/tasks/bulk-move", () => {
    it("moves tasks to a different project", async () => {
      const p1 = await prisma.project.create({ data: { name: `src-${Date.now()}` } });
      const p2 = await prisma.project.create({ data: { name: `dst-${Date.now()}` } });
      const t1 = await prisma.task.create({ data: { title: "Move1", projectId: p1.id, sortOrder: 0 } });
      const t2 = await prisma.task.create({ data: { title: "Move2", projectId: p1.id, sortOrder: 1 } });
      const res = await request(app)
        .patch("/api/tasks/bulk-move")
        .send({ taskIds: [t1.id, t2.id], projectId: p2.id });
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      const moved = await prisma.task.findMany({ where: { id: { in: [t1.id, t2.id] } } });
      expect(moved.every(t => t.projectId === p2.id)).toBe(true);
    });

    it("returns 404 for non-existent target project", async () => {
      const project = await prisma.project.create({ data: { name: `movesrc-${Date.now()}` } });
      const t = await prisma.task.create({ data: { title: "MoveX", projectId: project.id, sortOrder: 0 } });
      const res = await request(app)
        .patch("/api/tasks/bulk-move")
        .send({ taskIds: [t.id], projectId: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("rejects missing projectId", async () => {
      const res = await request(app)
        .patch("/api/tasks/bulk-move")
        .send({ taskIds: ["some-id"] });
      expect(res.status).toBe(400);
    });
  });

  describe("bulk AI tools", () => {
    it("bulk_complete_tasks via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const project = await prisma.project.create({ data: { name: `aibulk-${Date.now()}` } });
      const t1 = await prisma.task.create({ data: { title: "BT1", projectId: project.id, sortOrder: 0 } });
      const t2 = await prisma.task.create({ data: { title: "BT2", projectId: project.id, sortOrder: 1 } });
      const result = await executeTool("bulk_complete_tasks", { taskIds: [t1.id, t2.id], completed: true });
      expect(result).toHaveProperty("count", 2);
    });

    it("bulk_delete_tasks via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const project = await prisma.project.create({ data: { name: `aibulkdel-${Date.now()}` } });
      const t = await prisma.task.create({ data: { title: "BD1", projectId: project.id, sortOrder: 0 } });
      const result = await executeTool("bulk_delete_tasks", { taskIds: [t.id] });
      expect(result).toHaveProperty("count");
    });

    it("bulk_move_tasks via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const p1 = await prisma.project.create({ data: { name: `aibulkmov1-${Date.now()}` } });
      const p2 = await prisma.project.create({ data: { name: `aibulkmov2-${Date.now()}` } });
      const t = await prisma.task.create({ data: { title: "BM1", projectId: p1.id, sortOrder: 0 } });
      const result = await executeTool("bulk_move_tasks", { taskIds: [t.id], projectId: p2.id });
      expect(result).toHaveProperty("count", 1);
    });

    it("bulk_complete_tasks rejects empty array", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      await expect(executeTool("bulk_complete_tasks", { taskIds: [], completed: true }))
        .rejects.toThrow();
    });
  });

  describe("list_tasks AI tool (enhanced)", () => {
    it("filters by dueBefore via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const project = await prisma.project.create({ data: { name: `aitool-${Date.now()}` } });
      await prisma.task.create({
        data: { title: "Soon", projectId: project.id, sortOrder: 0, dueDate: new Date("2026-03-05") },
      });
      await prisma.task.create({
        data: { title: "Later", projectId: project.id, sortOrder: 1, dueDate: new Date("2026-12-01") },
      });
      const result = await executeTool("list_tasks", { projectId: project.id, dueBefore: "2026-03-10" }) as unknown[];
      expect(result.length).toBe(1);
      expect((result[0] as { title: string }).title).toBe("Soon");
    });

    it("sorts by dueDate via toolExecutor", async () => {
      const { executeTool } = await import("../ai/toolExecutor.js");
      const project = await prisma.project.create({ data: { name: `aisort-${Date.now()}` } });
      await prisma.task.create({
        data: { title: "Later", projectId: project.id, sortOrder: 0, dueDate: new Date("2026-06-01") },
      });
      await prisma.task.create({
        data: { title: "Soon", projectId: project.id, sortOrder: 1, dueDate: new Date("2026-03-01") },
      });
      const result = await executeTool("list_tasks", { projectId: project.id, sortBy: "dueDate", sortOrder: "asc" }) as { title: string }[];
      expect(result[0].title).toBe("Soon");
    });
  });
});
