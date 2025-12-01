import { gramjsClient } from "../gramjs-client";
import { logger } from "../logger";
import type { Tool } from "./types";

export const searchMessagesTool: Tool = {
  definition: {
    name: "search_messages",
    description:
      "Search for messages in the current Telegram chat. Use when user asks to find, search, or look up past messages. Telegram search looks for messages containing ALL the words in the query (AND logic), not ANY of them (OR logic). If searching for alternative terms, make separate search requests.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query - a word or phrase to find in messages. Telegram will match messages containing all words in this query. Do NOT use space-separated alternatives like 'generate create make' - these won't work. Instead, use a single specific term or call this tool multiple times with different queries.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 50)",
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput) => {
    const query = toolInput.query as string;
    const limit = (toolInput.limit as number | undefined) ?? 10;

    logger.info({ query, limit }, "Message search request received");

    try {
      const results = await gramjsClient.searchMessages({ query, limit });

      if (results.length === 0) {
        logger.info({ query }, "No messages found");
        return { success: true, query, results: [] };
      }

      logger.info({ query, count: results.length }, "Message search completed");
      return {
        success: true,
        query,
        results: results.map((msg) => ({
          text: msg.text,
          date: msg.date.toISOString(),
        })),
      };
    } catch (error) {
      logger.error({ query, error: error instanceof Error ? error.message : error }, "Message search failed");
      return {
        success: false,
        query,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
