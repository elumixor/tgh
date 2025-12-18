import type { Tool } from "agents/agent";
import { getMemory } from "services/memory/memory-store";

export const getMemoryTool: Tool = {
  definition: {
    name: "get_memory",
    description: "Retrieve a specific memory by its ID",
    input_schema: {
      type: "object",
      properties: {
        memoryId: {
          type: "string",
          description: "The ID of the memory to retrieve",
        },
      },
      required: ["memoryId"],
    },
  },

  // biome-ignore lint/suspicious/useAwait: Tool interface requires Promise return
  async execute(input: Record<string, unknown>) {
    const { memoryId } = input as { memoryId: string };

    const memory = getMemory(memoryId);

    if (!memory) {
      return { success: false, error: `Memory not found: ${memoryId}` };
    }

    return {
      success: true,
      memory: {
        id: memory.id,
        content: memory.content,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
      },
    };
  },
};
