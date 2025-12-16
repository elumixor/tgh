import type { Tool } from "agents/agent";
import { addMemory } from "services/memory/memory-store";

export const addMemoryTool: Tool = {
  definition: {
    name: "add_memory",
    description: "Store a new memory for future reference. Memories are searchable by semantic similarity.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to remember (fact, decision, instruction, etc.)",
        },
      },
      required: ["content"],
    },
  },

  async execute(input: Record<string, unknown>) {
    const { content } = input as { content: string };

    if (!content || content.trim().length === 0) {
      return { success: false, error: "Content cannot be empty" };
    }

    const memoryId = await addMemory(content.trim());

    return {
      success: true,
      memoryId,
      message: "Memory stored successfully",
    };
  },
};
