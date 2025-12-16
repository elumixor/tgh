import type { Tool } from "agents/agent";
import { searchMemories } from "services/memory/memory-store";

export const searchMemoriesTool: Tool = {
  definition: {
    name: "search_memories",
    description: "Search for relevant memories using semantic similarity. Returns memories ranked by relevance.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant memories",
        },
        topK: {
          type: "number",
          description: "Maximum number of results to return (default: 5, max: 10)",
        },
      },
      required: ["query"],
    },
  },

  async execute(input: Record<string, unknown>) {
    const { query, topK = 5 } = input as { query: string; topK?: number };

    const limitedTopK = Math.min(Math.max(1, topK), 10);
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
