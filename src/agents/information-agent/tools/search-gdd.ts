import type { Tool } from "agents/agent";
import { logger } from "logger";
import { notionClient } from "services/notion/notion-client";

export const searchGDDTool: Tool = {
  definition: {
    name: "search_gdd",
    description:
      "Search the Game Design Document (GDD) in Notion for specific topics, features, or design decisions. Use when user asks about game design, mechanics, systems, or anything defined in the GDD. Returns matching pages with titles and URLs.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for GDD content (e.g., 'player movement', 'enemy AI', 'skill system')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 5, max: 20)",
          minimum: 1,
          maximum: 20,
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput) => {
    const query = toolInput.query as string;
    const limit = ((toolInput.limit as number | undefined) ?? 5) as number;

    logger.info({ query, limit }, "GDD search request");

    const pages = await notionClient.searchPages(query, limit);

    return {
      query,
      results: pages.map((page) => ({
        id: page.id,
        title: page.title,
        url: page.url,
        lastEdited: page.lastEditedTime,
      })),
    };
  },
};
