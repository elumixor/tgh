import type { Tool } from "agents/agent";
import { logger } from "logger";
import { searchMemories } from "services/memory/memory-store";

export const searchMemoriesTool: Tool = {
  definition: {
    name: "search_memories",
    description:
      "Search your agent memories using semantic similarity. Use when you need to recall past conversations, decisions, or information from previous interactions. Returns relevant memories ranked by similarity.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for in memories (e.g., 'user preferences', 'past decisions about UI')",
        },
        topK: {
          type: "number",
          description: "Number of most relevant memories to return (default: 5, max: 10)",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput) => {
    const query = toolInput.query as string;
    const topK = ((toolInput.topK as number | undefined) ?? 5) as number;

    logger.info({ query, topK }, "Memory search request");

    const memories = await searchMemories(query, topK);

    return {
      query,
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        content: m.content,
        similarity: m.similarity,
        timestamp: m.createdAt,
      })),
    };
  },
};
