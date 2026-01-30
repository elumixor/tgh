import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { notionClient } from "services/notion/notion-client";
import { z } from "zod";

export const getGDDPageTool: ToolDefinition = {
  name: "get_gdd_page",
  description:
    "Retrieve the complete content of a specific Game Design Document (GDD) page from Notion. Use this after search_gdd to read the full detailed content of a page. The GDD contains all project documentation including game mechanics, character descriptions, art direction, story, and technical specs. Returns the full page content in markdown format with all nested sections.",
  parameters: z.object({
    pageId: z.string().describe("The Notion page ID obtained from search_gdd results"),
  }),
  execute: async ({ pageId }) => {
    logger.info({ pageId }, "GDD page content request");
    const pageContent = await notionClient.getPageContent(pageId);
    return {
      id: pageContent.id,
      title: pageContent.title,
      content: pageContent.content,
      url: pageContent.url,
    };
  },
};
