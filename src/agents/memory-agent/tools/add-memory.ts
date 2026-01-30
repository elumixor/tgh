import type { ToolDefinition } from "@agents/streaming-agent";
import { addMemory } from "services/memory/memory-store";
import { z } from "zod";

export const addMemoryTool: ToolDefinition = {
  name: "add_memory",
  description: "Store a new memory for future reference. Memories are searchable by semantic similarity.",
  parameters: z.object({
    content: z.string().describe("The content to remember (fact, decision, instruction, etc.)"),
  }),
  execute: async ({ content }) => {
    if (!content || content.trim().length === 0) throw new Error("Content cannot be empty");
    const memoryId = await addMemory(content.trim());
    return { memoryId, message: "Memory stored successfully" };
  },
};
