import type { Tool } from "agents/agent";
import { logger } from "logger";
import { notionClient } from "services/notion/notion-client";

export const getGDDPageTool: Tool = {
  definition: {
    name: "get_gdd_page",
    description:
      "Get the full content of a specific GDD page in Notion. Use after searching to read the actual content. Returns the page content in markdown format with all nested blocks.",
    input_schema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The Notion page ID from search results",
        },
      },
      required: ["pageId"],
    },
  },
  execute: async (toolInput) => {
    const pageId = toolInput.pageId as string;

    logger.info({ pageId }, "GDD page content request");

    try {
      const pageContent = await notionClient.getPageContent(pageId);

      return {
        success: true,
        id: pageContent.id,
        title: pageContent.title,
        content: pageContent.content,
        url: pageContent.url,
      };
    } catch (error) {
      logger.error({ pageId, error: error instanceof Error ? error.message : error }, "Failed to get GDD page");
      return {
        success: false,
        pageId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
