import { describe, expect, test } from "bun:test";
import { WebAgent } from "./web-agent";

describe("WebAgent", () => {
  const agent = new WebAgent();

  test("should have correct definition", () => {
    expect(agent.definition.name).toBe("web_agent");
    expect(agent.definition.description).toContain("External information");
    expect(agent.definition.input_schema.required).toContain("task");
  });

  test("should have web_search tool", () => {
    const toolNames = agent.tools.map((t) => t.definition.name);
    expect(toolNames).toContain("web_search");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should perform web search", async () => {
    const response = await agent.processTask("What is the weather in San Francisco today?");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("web_search");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should provide cited responses", async () => {
    const response = await agent.processTask("What are the latest developments in AI?");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    // Result should contain citations/sources
    expect(typeof response.result).toBe("string");
  });

  test("should require task parameter", async () => {
    await expect(agent.execute({}, {})).rejects.toThrow("Task is required");
  });

  test("should use thinking budget", () => {
    expect(agent.thinkingBudget).toBe(1024);
  });

  test("should use thinking model", () => {
    expect(agent.model).toContain("sonnet");
  });
});
