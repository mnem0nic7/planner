import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Conversations API", () => {
  describe("GET /api/conversations", () => {
    it("returns 200 with array", async () => {
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("returns conversations ordered by most recent", async () => {
      const c1 = await prisma.conversation.create({ data: { title: "First" } });
      // Ensure different updatedAt
      await new Promise((r) => setTimeout(r, 10));
      const c2 = await prisma.conversation.create({ data: { title: "Second" } });
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      const idx1 = res.body.findIndex((c: { id: string }) => c.id === c1.id);
      const idx2 = res.body.findIndex((c: { id: string }) => c.id === c2.id);
      expect(idx2).toBeLessThan(idx1); // Second is more recent, appears first
    });
  });

  describe("GET /api/conversations/:id", () => {
    it("returns conversation with messages", async () => {
      const conv = await prisma.conversation.create({
        data: {
          title: "Test",
          messages: {
            create: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi there!" },
            ],
          },
        },
      });
      const res = await request(app).get(`/api/conversations/${conv.id}`);
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(2);
    });

    it("returns 404 for missing conversation", async () => {
      const res = await request(app).get("/api/conversations/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/conversations/:id", () => {
    it("deletes conversation and messages", async () => {
      const conv = await prisma.conversation.create({
        data: {
          title: "Delete me",
          messages: { create: [{ role: "user", content: "Hello" }] },
        },
      });
      const res = await request(app).delete(`/api/conversations/${conv.id}`);
      expect(res.status).toBe(204);

      const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
      });
      expect(messages).toHaveLength(0);
    });

    it("returns 404 for nonexistent conversation", async () => {
      const res = await request(app).delete("/api/conversations/nonexistent");
      expect(res.status).toBe(404);
    });
  });
});
