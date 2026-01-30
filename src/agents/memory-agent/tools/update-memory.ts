import type { ToolDefinition } from "@agents/streaming-agent";
import { updateMemory } from "services/memory/memory-store";
import { z } from "zod";

export const updateMemoryTool: ToolDefinition = {
  name: "update_memory",
  description: "Update the content of an existing memory",
  parameters: z.object({
    memoryId: z.string().describe("The ID of the memory to update"),
    newContent: z.string().describe("The new content for the memory"),
  }),
  execute: async ({ memoryId, newContent }) => {
    if (!newContent || newContent.trim().length === 0) throw new Error("New content cannot be empty");
    const updated = await updateMemory(memoryId, newContent.trim());
    if (!updated) throw new Error(`Memory not found: ${memoryId}`);
    return { message: "Memory updated successfully" };
  },
};
