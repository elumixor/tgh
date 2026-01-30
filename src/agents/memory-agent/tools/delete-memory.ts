import type { ToolDefinition } from "@agents/streaming-agent";
import { deleteMemory } from "services/memory/memory-store";
import { z } from "zod";

export const deleteMemoryTool: ToolDefinition = {
  name: "delete_memory",
  description: "Delete a memory by its ID. Use search_memories first to find the ID.",
  parameters: z.object({
    memoryId: z.string().describe("The ID of the memory to delete"),
  }),
  execute: async ({ memoryId }) => {
    const deleted = await deleteMemory(memoryId);
    if (!deleted) throw new Error(`Memory not found: ${memoryId}`);
    return { message: `Memory ${memoryId} deleted successfully` };
  },
};
