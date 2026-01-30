import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { notionClient } from "services/notion/notion-client";
import { z } from "zod";

export const searchGDDTool: ToolDefinition = {
  name: "search_gdd",
  description:
    "Search the Game Design Document (GDD) stored in Notion for project documentation, game design specs, mechanics, features, character descriptions, and design decisions. The GDD is the authoritative source for all game-related information. Use this when the user asks about game design, characters, mechanics, systems, art style, story, or any project-specific information. Returns matching Notion pages with titles and URLs.",
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query for GDD/Notion content. Examples: 'player movement mechanics', 'Lucy character design', 'enemy AI behavior', 'skill system'",
      ),
    limit: z.number().min(1).max(20).optional().describe("Maximum number of results to return (default: 5, max: 20)"),
  }),
  execute: async ({ query, limit }) => {
    const maxLimit = limit ?? 5;
    logger.info({ query, limit: maxLimit }, "GDD search request");

    const pages = await notionClient.searchPages(query, maxLimit);

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
