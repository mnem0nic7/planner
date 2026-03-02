import { Router } from "express";
import { prisma } from "../db.js";
import { streamChat } from "../ai/agent.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const router = Router();

// GET /api/conversations
router.get("/conversations", async (_req, res) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  res.json(conversations);
});

// GET /api/conversations/:id
router.get("/conversations/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(conversation);
});

// DELETE /api/conversations/:id
router.delete("/conversations/:id", async (req, res) => {
  await prisma.conversation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /api/chat — streaming SSE endpoint
router.post("/chat", async (req, res) => {
  const { conversationId, message } = req.body as {
    conversationId?: string;
    message: string;
  };

  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { title: message.slice(0, 100) },
      include: { messages: true },
    });
  }

  // Rebuild OpenAI message history from DB
  const history: ChatCompletionMessageParam[] = conversation.messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        tool_call_id: m.toolCallId!,
        content: m.content || "",
      };
    }
    if (m.role === "assistant" && m.toolCalls) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: JSON.parse(m.toolCalls),
      };
    }
    return {
      role: m.role as "user" | "assistant",
      content: m.content || "",
    };
  });

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const newMessages = await streamChat(res, history, message);

    // Save all new messages to DB
    for (const msg of newMessages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : null,
          toolCalls: "tool_calls" in msg && msg.tool_calls
            ? JSON.stringify(msg.tool_calls)
            : null,
          toolCallId: "tool_call_id" in msg ? (msg.tool_call_id as string) : null,
        },
      });
    }

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    res.write(`event: done\ndata: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    res.write(`event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`);
  }

  res.end();
});

export { router as chatRoutes };
