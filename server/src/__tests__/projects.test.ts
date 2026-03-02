import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Projects API", () => {
  describe("GET /api/projects", () => {
    it("returns empty array when no projects exist", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns all projects", async () => {
      await prisma.project.create({ data: { name: "Test Project" } });
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Test Project");
    });
  });

  describe("POST /api/projects", () => {
    it("creates a project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({ name: "New Project", color: "#ff0000" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("New Project");
      expect(res.body.color).toBe("#ff0000");
      expect(res.body.id).toBeDefined();
    });

    it("rejects project without name", async () => {
      const res = await request(app).post("/api/projects").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns project with tasks", async () => {
      const project = await prisma.project.create({
        data: {
          name: "Test",
          tasks: { create: [{ title: "Task 1", sortOrder: 0 }] },
        },
      });
      const res = await request(app).get(`/api/projects/${project.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test");
      expect(res.body.tasks).toHaveLength(1);
    });

    it("returns 404 for missing project", async () => {
      const res = await request(app).get("/api/projects/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("updates a project", async () => {
      const project = await prisma.project.create({ data: { name: "Old" } });
      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({ name: "New" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("deletes a project and its tasks", async () => {
      const project = await prisma.project.create({
        data: {
          name: "Delete Me",
          tasks: { create: [{ title: "Task", sortOrder: 0 }] },
        },
      });
      const res = await request(app).delete(`/api/projects/${project.id}`);
      expect(res.status).toBe(204);

      const tasks = await prisma.task.findMany({
        where: { projectId: project.id },
      });
      expect(tasks).toHaveLength(0);
    });
  });
});
