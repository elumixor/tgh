import type { ToolDefinition } from "@agents/streaming-agent";
import { searchMemories } from "services/memory/memory-store";
import { z } from "zod";

export const searchMemoriesTool: ToolDefinition = {
  name: "search_memories",
  description: "Search for relevant memories using semantic similarity. Returns memories ranked by relevance.",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant memories"),
    topK: z.number().optional().describe("Maximum number of results to return (default: 5, max: 10)"),
  }),
  execute: async ({ query, topK }) => {
    const limitedTopK = Math.min(Math.max(1, topK ?? 5), 10);
    const results = await searchMemories(query, limitedTopK);
    return {
      success: true,
      query,
      results: results.map((m) => ({
        id: m.id,
        content: m.content,
        similarity: m.similarity,
        createdAt: m.createdAt,
      })),
    };
  },
};
