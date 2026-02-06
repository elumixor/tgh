import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionClient } from "services/notion";
import { simplifyPageProperties } from "services/notion/notion-helpers";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const editPageTool = defineTool(
  "EditPage",
  "Update properties of an existing Notion page. Only specified properties will be updated, others remain unchanged. Use this to add data to Sensitive Data after automation creates the relation.",
  z.object({
    page_id: z.string().describe("The ID of the page to update"),
    properties: z
      .record(z.string(), z.unknown())
      .describe(
        "Properties to update in Notion API format. Example: {Passport: {rich_text: [{text: {content: 'AB123456'}}]}, Salary: {number: 50}}",
      ),
  }),
  async ({ page_id, properties }, _context) => {
    const response = await notionClient.pages.update({
      page_id,
      // biome-ignore lint: Notion SDK accepts flexible property formats
      properties: properties as any,
    });

    if (!("properties" in response)) throw new Error("Updated page does not have properties");

    const typedPage = response as PageObjectResponse;
    const simplifiedProperties = simplifyPageProperties(typedPage);

    return {
      id: response.id,
      url: response.url,
      updated_properties: simplifiedProperties,
    };
  },
);
