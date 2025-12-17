import type { Tool } from "agents/agent";
import { logger } from "logger";
import { updateMemory } from "services/memory/memory-store";

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

    const success = await updateMemory(memoryId, newContent);

    if (!success) throw new Error(`Memory not found: ${memoryId}`);

    return {
      memoryId,
      message: "Memory updated successfully",
    };
  },
};
