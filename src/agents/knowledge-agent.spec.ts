import { describe, expect, test } from "bun:test";
import { KnowledgeAgent } from "./knowledge-agent";

describe("KnowledgeAgent", () => {
  const agent = new KnowledgeAgent();

  test("should have correct definition", () => {
    expect(agent.definition.name).toBe("knowledge_agent");
    expect(agent.definition.description).toContain("Knowledge management");
    expect(agent.definition.input_schema.required).toContain("task");
  });

  test("should have all required tools", () => {
    const toolNames = agent.tools.map((t) => t.definition.name);

    // GDD tools
    expect(toolNames).toContain("search_gdd");
    expect(toolNames).toContain("get_gdd_page");

    // Memory tools
    expect(toolNames).toContain("search_memories");
    expect(toolNames).toContain("add_memory");
    expect(toolNames).toContain("update_memory");
    expect(toolNames).toContain("get_memory");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should search GDD", async () => {
    const response = await agent.processTask("Search the GDD for player movement mechanics");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("search_gdd");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should search memories", async () => {
    const response = await agent.processTask("What do we know about user preferences?");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    // Should use search_memories to recall stored knowledge
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should add memory", async () => {
    const response = await agent.processTask("Remember that the user prefers concise responses");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("add_memory");
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
