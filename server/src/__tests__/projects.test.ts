import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Projects API", () => {
  describe("GET /api/projects", () => {
    it("returns 200 with array", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns created project", async () => {
      const project = await prisma.project.create({ data: { name: "Unique-Proj-List" } });
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      const found = res.body.find((p: { id: string }) => p.id === project.id);
      expect(found).toBeDefined();
      expect(found.name).toBe("Unique-Proj-List");
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

  describe("POST /api/projects validation", () => {
    it("rejects whitespace-only name", async () => {
      const res = await request(app).post("/api/projects").send({ name: "   " });
      expect(res.status).toBe(400);
    });

    it("rejects non-string name", async () => {
      const res = await request(app).post("/api/projects").send({ name: 123 });
      expect(res.status).toBe(400);
    });

    it("rejects oversized name", async () => {
      const res = await request(app).post("/api/projects").send({ name: "x".repeat(201) });
      expect(res.status).toBe(400);
    });

    it("rejects oversized description", async () => {
      const res = await request(app).post("/api/projects").send({ name: "OK", description: "x".repeat(2001) });
      expect(res.status).toBe(400);
    });

    it("trims name whitespace", async () => {
      const res = await request(app).post("/api/projects").send({ name: "  My Project  " });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("My Project");
    });
  });

  describe("PATCH /api/projects/:id validation", () => {
    it("returns 404 for nonexistent project", async () => {
      const res = await request(app).patch("/api/projects/nonexistent").send({ name: "X" });
      expect(res.status).toBe(404);
    });

    it("rejects invalid color", async () => {
      const project = await prisma.project.create({ data: { name: "PatchColor" } });
      const res = await request(app).patch(`/api/projects/${project.id}`).send({ color: "bad" });
      expect(res.status).toBe(400);
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

    it("returns 404 for nonexistent project", async () => {
      const res = await request(app).delete("/api/projects/nonexistent");
      expect(res.status).toBe(404);
    });
  });
});
