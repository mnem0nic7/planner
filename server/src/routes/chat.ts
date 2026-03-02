import { Router } from "express";
import { prisma } from "../db.js";
import { streamChat } from "../ai/agent.js";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const MAX_MESSAGE_LENGTH = 2000;

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
  const existing = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await prisma.conversation.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /api/chat — streaming SSE endpoint
router.post("/chat", async (req, res) => {
  const { conversationId, message } = req.body as {
    conversationId?: string;
    message: string;
  };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` });
    return;
  }

  // Track client disconnect to abort in-flight AI calls
  const abortSignal = { aborted: false };
  res.once("close", () => {
    if (!res.writableFinished) {
      abortSignal.aborted = true;
    }
  });

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

  // Rebuild OpenAI message history from DB (limit to last 50 messages to avoid token overflow)
  const MAX_HISTORY_MESSAGES = 50;
  const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
  const history: ChatCompletionMessageParam[] = [];
  for (const m of recentMessages) {
    if (m.role === "tool") {
      history.push({
        role: "tool" as const,
        tool_call_id: m.toolCallId!,
        content: m.content || "",
      });
    } else if (m.role === "assistant" && m.toolCalls) {
      let toolCalls;
      try {
        toolCalls = JSON.parse(m.toolCalls);
      } catch {
        continue; // Skip malformed tool call records
      }
      history.push({
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: toolCalls,
      });
    } else if (m.role === "user" || m.role === "assistant") {
      history.push({
        role: m.role as "user" | "assistant",
        content: m.content || "",
      });
    }
    // Skip messages with unknown roles
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const newMessages = await streamChat(res, history, message, abortSignal);

    // Save all new messages to DB (even if client disconnected, so conversation state is consistent)
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

    if (!abortSignal.aborted) {
      res.write(`event: done\ndata: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat error:", errMsg);
    if (!abortSignal.aborted) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`);
    }
  }

  res.end();
});

export { router as chatRoutes };
