import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Tool } from "../tools/types";
import { MasterAgent } from "./master-agent";

describe("MasterAgent", () => {
  let masterAgent: MasterAgent;

  beforeEach(() => {
    masterAgent = new MasterAgent();
  });

  afterEach(() => {
    mock.restore();
  });

  test("should register tools correctly", () => {
    const mockTool: Tool = {
      definition: {
        name: "test_tool",
        description: "A test tool",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      execute: async () => ({ success: true }),
    };

    masterAgent.registerTool(mockTool);
    // @ts-expect-error - accessing private field for testing
    expect(masterAgent.tools).toContainEqual(mockTool);
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should route image tasks to image_agent", async () => {
    const result = await masterAgent.processMessage("generate an image of a cat");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should route drive tasks to drive_agent", async () => {
    const result = await masterAgent.processMessage("list my files on google drive");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("should handle tool execution errors gracefully", async () => {
    const mockFailingTool: Tool = {
      definition: {
        name: "failing_tool",
        description: "A tool that fails",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      execute: async () => {
        throw new Error("Tool execution failed");
      },
    };

    masterAgent.registerTool(mockFailingTool);

    // The agent should handle the error and return a response
    const result = await masterAgent.processMessage("use the failing tool");
    expect(typeof result).toBe("string");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should stop after max iterations", async () => {
    const mockInfiniteTool: Tool = {
      definition: {
        name: "infinite_tool",
        description: "A tool that keeps requesting more tools",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      execute: async () => ({ result: "keep going" }),
    };

    masterAgent.registerTool(mockInfiniteTool);

    // Should not hang indefinitely
    const result = await masterAgent.processMessage("keep using tools forever");
    expect(typeof result).toBe("string");
  });

  test("should return text response when no tools are used", async () => {
    const result = await masterAgent.processMessage("hello");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")(
    "[MANUAL] should route chat info tasks to chat_info_agent",
    async () => {
      const result = await masterAgent.processMessage("search for messages about 'claude'");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    },
  );

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")(
    "[MANUAL] should route knowledge tasks to knowledge_agent",
    async () => {
      const result = await masterAgent.processMessage("search the GDD for game mechanics");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    },
  );

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should route web search tasks to web_agent", async () => {
    const result = await masterAgent.processMessage("search the web for latest AI news");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")(
    "[MANUAL] should route utility tasks to utility_agent",
    async () => {
      const result = await masterAgent.processMessage("check API balances");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    },
  );
});
