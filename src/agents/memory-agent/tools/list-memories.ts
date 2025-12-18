import type { Tool } from "agents/agent";
import { getAllMemories } from "services/memory/memory-store";

export const listMemoriesTool: Tool = {
  definition: {
    name: "list_memories",
    description: "List all stored memories with their IDs, content, and timestamps",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // biome-ignore lint/suspicious/useAwait: Tool interface requires Promise return
  async execute() {
    const memories = getAllMemories();

    return {
      success: true,
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };
  },
};
