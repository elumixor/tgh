import type { Tool } from "agents/agent";
import { deleteMemory } from "services/memory/local-memory-store";

export const deleteMemoryLocalTool: Tool = {
  definition: {
    name: "delete_memory",
    description: "Delete a memory by its ID. Use search_memories first to find the ID.",
    input_schema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to delete",
        },
      },
      required: ["memoryId"],
    },
  },

  async execute(input: Record<string, unknown>) {
    const { memoryId } = input as { memoryId: string };

    const deleted = await deleteMemory(memoryId);

    if (!deleted) {
      return { success: false, error: `Memory not found: ${memoryId}` };
    }

    return { success: true, message: `Memory ${memoryId} deleted successfully` };
  },
};
