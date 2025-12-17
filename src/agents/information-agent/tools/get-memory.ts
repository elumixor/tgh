import type { Tool } from "agents/agent";
import { logger } from "logger";
import { getMemory } from "services/memory/memory-store";

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
          description: "The ID of the memory to retrieve",
        },
      },
      required: ["memoryId"],
    },
  },
  execute: async (toolInput) => {
    const memoryId = toolInput.memoryId as string;

    logger.info({ memoryId }, "Get memory request");

    const memory = getMemory(memoryId);

    if (!memory) throw new Error(`Memory not found: ${memoryId}`);

    return {
      memory: {
        id: memory.id,
        content: memory.content,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    };
  },
};
