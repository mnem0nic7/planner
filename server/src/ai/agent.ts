import OpenAI from "openai";
import type { Response } from "express";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { tools } from "./tools.js";
import { executeTool } from "./toolExecutor.js";

const MAX_TOOL_ITERATIONS = 10;

const openai = new OpenAI();

function buildSystemPrompt(): string {
  return `You are an AI assistant for a personal planner app. Today is ${new Date().toISOString().split("T")[0]}.

You help the user manage their projects, tasks, and tags. Be concise and action-oriented.
When the user asks you to do something, use your tools to do it immediately — don't just describe what you would do.
After making changes, briefly confirm what you did.
When asked about workload or status, proactively check for overdue tasks and suggest priorities.`;
}

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function streamChat(
  res: Response,
  history: ChatCompletionMessageParam[],
  userMessage: string,
  abortSignal?: { aborted: boolean }
): Promise<ChatCompletionMessageParam[]> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: userMessage },
  ];

  const newMessages: ChatCompletionMessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    // Abort if client disconnected
    if (abortSignal?.aborted) break;

    iterations++;

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      stream: true,
    });

    let contentAccumulator = "";
    const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      if (abortSignal?.aborted) break;

      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        contentAccumulator += delta.content;
        sendSSE(res, "content", { delta: delta.content });
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAccumulators.has(tc.index)) {
            toolCallAccumulators.set(tc.index, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
          }
          const acc = toolCallAccumulators.get(tc.index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }

    if (toolCallAccumulators.size > 0) {
      const assistantMsg: ChatCompletionMessageParam = {
        role: "assistant",
        content: contentAccumulator || null,
        tool_calls: [...toolCallAccumulators.values()].map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMsg);
      newMessages.push(assistantMsg);

      for (const tc of toolCallAccumulators.values()) {
        if (abortSignal?.aborted) break;

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          const errMsg = `Failed to parse tool arguments: ${tc.arguments.slice(0, 100)}`;
          const toolMsg: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errMsg }),
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
          sendSSE(res, "tool_result", { id: tc.id, name: tc.name, error: errMsg });
          continue;
        }

        sendSSE(res, "tool_call", { id: tc.id, name: tc.name, args });

        try {
          const result = await executeTool(tc.name, args);
          sendSSE(res, "tool_result", { id: tc.id, name: tc.name, result });

          const toolMsg: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          const toolMsg: ChatCompletionMessageParam = {
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: errMsg }),
          };
          messages.push(toolMsg);
          newMessages.push(toolMsg);
          sendSSE(res, "tool_result", { id: tc.id, name: tc.name, error: errMsg });
        }
      }
    } else {
      if (contentAccumulator) {
        newMessages.push({ role: "assistant", content: contentAccumulator });
      }
      break;
    }
  }

  return newMessages;
}
