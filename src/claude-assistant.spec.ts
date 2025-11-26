import { describe, expect, test } from "bun:test";
import { ClaudeAssistant } from "./claude-assistant";

describe("ClaudeAssistant", () => {
  const assistant = new ClaudeAssistant();

  test.skipIf(!process.env.RUN_MANUAL_TESTS)("should answer a math question", async () => {
    const response = await assistant.processMessage("What's 2+2?");
    expect(response).toBeDefined();
    expect(response).toContain("4");
    console.log("Math response:", response);
  });
});
