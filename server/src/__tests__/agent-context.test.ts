import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../ai/agent.js";

describe("buildSystemPrompt", () => {
  it("returns base prompt without project context", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("AI assistant for a personal planner app");
    expect(prompt).not.toContain("Current Project Context");
  });

  it("includes project context when provided", () => {
    const context = '--- Current Project Context ---\nViewing "Test Project"';
    const prompt = buildSystemPrompt(context);
    expect(prompt).toContain("Current Project Context");
    expect(prompt).toContain("Test Project");
  });
});
