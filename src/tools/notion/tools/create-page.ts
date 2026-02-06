import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionClient } from "services/notion";
import { simplifyPageProperties } from "services/notion/notion-helpers";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const createPageTool = defineTool(
  "CreatePage",
  "Create a new page in a Notion database. Properties must match the database schema. Use get_database_info first to see available properties and their types.",
  z.object({
    database_id: z.string().describe("The ID of the database to create the page in"),
    properties: z
      .record(z.string(), z.unknown())
      .describe(
        "Page properties as Notion API format. Example: {Name: {title: [{text: {content: 'John'}}]}, Email: {email: 'john@example.com'}, Role: {relation: [{id: 'role_page_id'}]}}",
      ),
  }),
  async ({ database_id, properties }, _context) => {
    const response = await notionClient.pages.create({
      parent: { database_id },
      // biome-ignore lint: Notion SDK accepts flexible property formats
      properties: properties as any,
    });

    if (!("properties" in response)) throw new Error("Created page does not have properties");

    const typedPage = response as PageObjectResponse;
    const simplifiedProperties = simplifyPageProperties(typedPage);

    return {
      id: response.id,
      url: response.url,
      properties: simplifiedProperties,
    };
  },
);
