import { describe, expect, test } from "bun:test";
import { ChatInfoAgent } from "./chat-info-agent";

describe("ChatInfoAgent", () => {
  const agent = new ChatInfoAgent();

  test("should have correct definition", () => {
    expect(agent.definition.name).toBe("chat_info_agent");
    expect(agent.definition.description).toContain("Chat information");
    expect(agent.definition.input_schema.required).toContain("task");
  });

  test("should have all required tools", () => {
    const toolNames = agent.tools.map((t) => t.definition.name);
    expect(toolNames).toContain("search_messages");
    expect(toolNames).toContain("get_message_history");
    expect(toolNames).toContain("get_message_info");
    expect(toolNames).toContain("get_message_mentions");
    expect(toolNames).toContain("get_chat_info");
    expect(toolNames).toContain("transcribe_voice");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should search messages", async () => {
    const response = await agent.processTask("Find recent messages mentioning 'test'");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("search_messages");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should get message history", async () => {
    const response = await agent.processTask("Get the last 10 messages");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("get_message_history");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should get chat info", async () => {
    const response = await agent.processTask("Get information about this chat");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("get_chat_info");
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
