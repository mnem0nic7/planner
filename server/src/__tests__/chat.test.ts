import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Conversations API", () => {
  describe("GET /api/conversations", () => {
    it("returns empty array when no conversations exist", async () => {
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns conversations ordered by most recent", async () => {
      await prisma.conversation.create({ data: { title: "First" } });
      await prisma.conversation.create({ data: { title: "Second" } });
      const res = await request(app).get("/api/conversations");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("Second");
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
