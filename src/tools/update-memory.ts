import { logger } from "../logger";
import { memoryStore } from "../memory-store";
import type { Tool } from "./types";

export const updateMemoryTool: Tool = {
  definition: {
    name: "update_memory",
    description:
      "Update an existing memory with new information. Use when you need to refine or correct a previously stored memory. The embedding will be recalculated automatically.",
    input_schema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to update (from search results)",
        },
        newContent: {
          type: "string",
          description: "The updated content for this memory",
        },
      },
      required: ["memoryId", "newContent"],
    },
  },
  execute: async (toolInput) => {
    const memoryId = toolInput.memoryId as string;
    const newContent = toolInput.newContent as string;

    logger.info({ memoryId, contentLength: newContent.length }, "Update memory request");

    try {
      await memoryStore.updateMemory(memoryId, newContent);

      return {
        success: true,
        memoryId,
        message: "Memory updated successfully",
      };
    } catch (error) {
      logger.error({ memoryId, error: error instanceof Error ? error.message : error }, "Failed to update memory");
      return {
        success: false,
        memoryId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
