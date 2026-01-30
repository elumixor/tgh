import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { searchMemories } from "services/memory/memory-store";
import { z } from "zod";

export const searchMemoriesTool: ToolDefinition = {
  name: "search_memories",
  description:
    "Search your agent memories using semantic similarity. Use when you need to recall past conversations, decisions, or information from previous interactions. Returns relevant memories ranked by similarity.",
  parameters: z.object({
    query: z.string().describe("What to search for in memories (e.g., 'user preferences', 'past decisions about UI')"),
    topK: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of most relevant memories to return (default: 5, max: 10)"),
  }),
  execute: async ({ query, topK }) => {
    const k = topK ?? 5;
    logger.info({ query, topK: k }, "Memory search request");

    const memories = await searchMemories(query, k);

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
