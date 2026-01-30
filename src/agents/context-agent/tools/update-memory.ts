import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { updateMemory } from "services/memory/memory-store";
import { z } from "zod";

export const updateMemoryTool: ToolDefinition = {
  name: "update_memory",
  description:
    "Update an existing memory with new information. Use when you need to refine or correct a previously stored memory. The embedding will be recalculated automatically.",
  parameters: z.object({
    memoryId: z.string().describe("The ID of the memory to update (from search results)"),
    newContent: z.string().describe("The updated content for this memory"),
  }),
  execute: async ({ memoryId, newContent }) => {
    logger.info({ memoryId, contentLength: newContent.length }, "Update memory request");

    const success = await updateMemory(memoryId, newContent);
    if (!success) throw new Error(`Memory not found: ${memoryId}`);

    return { memoryId, message: "Memory updated successfully" };
  },
};
