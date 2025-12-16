import type { Tool } from "agents/agent";
import { logger } from "logger";
import { webSearch } from "services/perplexity";

export const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description:
      "Search the web for current information using Perplexity AI. Use when user asks questions that require up-to-date information, facts, news, or real-world data not in your knowledge base. Returns comprehensive answers with citations from recent web sources.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or question to ask. Be specific and clear.",
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput, context) => {
    const query = toolInput.query as string;
    logger.info({ query }, "Web search request");

    context.statusMessage.replaceWith("🔍 Searching the web...");

    const result = await webSearch(query);

    logger.info({ query, resultLength: result.length }, "Web search completed");

    return { query, result };
  },
};
