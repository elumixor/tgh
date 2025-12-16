import type { Tool } from "agents/agent";
import { updateMemory } from "services/memory/memory-store";

export const updateMemoryTool: Tool = {
  definition: {
    name: "update_memory",
    description: "Update the content of an existing memory",
    input_schema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to update",
        },
        newContent: {
          type: "string",
          description: "The new content for the memory",
        },
      },
      required: ["memoryId", "newContent"],
    },
  },

  async execute(input: Record<string, unknown>) {
    const { memoryId, newContent } = input as { memoryId: string; newContent: string };

    if (!newContent || newContent.trim().length === 0) {
      return { success: false, error: "New content cannot be empty" };
    }

    const updated = await updateMemory(memoryId, newContent.trim());

    if (!updated) {
      return { success: false, error: `Memory not found: ${memoryId}` };
    }

    return {
      success: true,
      message: "Memory updated successfully",
    };
  },
};
