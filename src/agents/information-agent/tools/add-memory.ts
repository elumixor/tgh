import type { Tool } from "agents/agent";
import { logger } from "logger";
import { addMemory } from "services/memory/memory-store";

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

    const memoryId = await addMemory(content);

    return {
      memoryId,
      message: "Memory stored successfully",
    };
  },
};
