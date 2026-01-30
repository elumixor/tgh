import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { addMemory } from "services/memory/memory-store";
import { z } from "zod";

export const addMemoryTool: ToolDefinition = {
  name: "add_memory",
  description:
    "Store a new memory for future reference. Use when you learn something important about the user, project, or ongoing work that should be remembered. The memory will be searchable semantically.",
  parameters: z.object({
    content: z
      .string()
      .describe(
        "What to remember (be specific and contextual, e.g., 'User prefers TypeScript over JavaScript for all new projects')",
      ),
  }),
  execute: async ({ content }) => {
    logger.info({ contentLength: content.length }, "Add memory request");
    const memoryId = await addMemory(content);
    return { memoryId, message: "Memory stored successfully" };
  },
};
