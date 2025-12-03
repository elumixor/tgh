import { describe, expect, test } from "bun:test";
import { UtilityAgent } from "./utility-agent";

describe("UtilityAgent", () => {
  const agent = new UtilityAgent();

  test("should have correct definition", () => {
    expect(agent.definition.name).toBe("utility_agent");
    expect(agent.definition.description).toContain("System operations");
    expect(agent.definition.input_schema.required).toContain("task");
  });

  test("should have get_api_balances tool", () => {
    const toolNames = agent.tools.map((t) => t.definition.name);
    expect(toolNames).toContain("get_api_balances");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should get API balances", async () => {
    const response = await agent.processTask("Check all API balances");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("get_api_balances");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should provide structured balance info", async () => {
    const response = await agent.processTask("Show me the current API balances");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(typeof response.result).toBe("string");
  });

  test("should require task parameter", async () => {
    await expect(agent.execute({}, {})).rejects.toThrow("Task is required");
  });

  test("should use thinking budget", () => {
    expect(agent.thinkingBudget).toBe(512);
  });

  test("should use thinking model", () => {
    expect(agent.model).toContain("sonnet");
  });
});
