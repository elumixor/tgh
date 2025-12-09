import type { Tool } from "agents/agent";
import { logger } from "logger";
import { memoryStore } from "services/notion/memory-store";

export const getMemoryTool: Tool = {
  definition: {
    name: "get_memory",
    description:
      "Retrieve a specific memory by its ID. Use when you have a memory ID from search results and need the full content.",
    input_schema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The Notion page ID of the memory",
        },
      },
      required: ["memoryId"],
    },
  },
  execute: async (toolInput) => {
    const memoryId = toolInput.memoryId as string;

    logger.info({ memoryId }, "Get memory request");

    try {
      const memory = await memoryStore.getMemory(memoryId);

      if (!memory) {
        return {
          success: false,
          memoryId,
          error: "Memory not found",
        };
      }

      return {
        success: true,
        memory: {
          id: memory.id,
          content: memory.content,
          timestamp: memory.timestamp,
          url: memory.url,
        },
      };
    } catch (error) {
      logger.error({ memoryId, error: error instanceof Error ? error.message : error }, "Failed to get memory");
      return {
        success: false,
        memoryId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
