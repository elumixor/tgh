import { logger } from "../logger";
import { memoryStore } from "../memory-store";
import type { Tool } from "./types";

export const addMemoryTool: Tool = {
  definition: {
    name: "add_memory",
    description:
      "Store a new memory for future reference. Use when you learn something important about the user, project, or ongoing work that should be remembered. The memory will be searchable semantically.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description:
            "What to remember (be specific and contextual, e.g., 'User prefers TypeScript over JavaScript for all new projects')",
        },
      },
      required: ["content"],
    },
  },
  execute: async (toolInput) => {
    const content = toolInput.content as string;

    logger.info({ contentLength: content.length }, "Add memory request");

    try {
      const memoryId = await memoryStore.addMemory(content);

      return {
        success: true,
        memoryId,
        message: "Memory stored successfully",
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Failed to add memory");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
