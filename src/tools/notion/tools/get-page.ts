import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionClient } from "services/notion";
import { simplifyPageProperties } from "services/notion/notion-helpers";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getPageTool = defineTool(
  "GetPage",
  "Retrieve a specific Notion page by ID including all its properties. Use this to check if a page was created successfully or to verify relations were established.",
  z.object({
    page_id: z.string().describe("The ID of the Notion page to retrieve"),
  }),
  async ({ page_id }) => {
    const page = await notionClient.pages.retrieve({ page_id });

    if (!("properties" in page)) {
      throw new Error("Page does not have properties (might be a database)");
    }

    const typedPage = page as PageObjectResponse;
    const properties = simplifyPageProperties(typedPage);

    return {
      id: page.id,
      url: page.url,
      properties,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
    };
  },
);
