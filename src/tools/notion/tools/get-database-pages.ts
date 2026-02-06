import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { notionClient } from "services/notion";
import { NotionFilterBuilder, simplifyPageProperties } from "services/notion/notion-helpers";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getDatabasePagesTool = defineTool(
  "GetDatabasePages",
  "Query a Notion database to find pages. Supports filtering by email, title, rich text, select values, and relations. Use this to check if a person already exists before creating, or to find specific entries.",
  z.object({
    database_id: z.string().describe("The ID of the Notion database to query"),
    filters: z
      .array(
        z.object({
          type: z
            .enum(["email_equals", "title_contains", "rich_text_contains", "select_equals", "relation_contains"])
            .describe("Type of filter to apply"),
          property: z.string().describe("Name of the property to filter on"),
          value: z.string().describe("Value to filter by"),
        }),
      )
      .nullable()
      .describe("Filters to apply (combined with AND logic), or null for no filtering."),
    page_size: z.number().min(1).max(100).default(10).describe("Maximum number of pages to return"),
  }),
  async ({ database_id, filters, page_size }, _context) => {
    const filterBuilder = new NotionFilterBuilder();

    if (filters) {
      for (const filter of filters) {
        switch (filter.type) {
          case "email_equals":
            filterBuilder.emailEquals(filter.property, filter.value);
            break;
          case "title_contains":
            filterBuilder.titleContains(filter.property, filter.value);
            break;
          case "rich_text_contains":
            filterBuilder.richTextContains(filter.property, filter.value);
            break;
          case "select_equals":
            filterBuilder.selectEquals(filter.property, filter.value);
            break;
          case "relation_contains":
            filterBuilder.relationContains(filter.property, filter.value);
            break;
        }
      }
    }

    // @ts-expect-error - Notion SDK types are incomplete
    const response = await notionClient.databases.query({
      database_id,
      filter: filterBuilder.build(),
      page_size,
    });

    const pages = response.results
      .filter(
        (page: unknown): page is PageObjectResponse =>
          typeof page === "object" && page !== null && "properties" in page,
      )
      .map((page: PageObjectResponse) => ({
        id: page.id,
        url: page.url,
        properties: simplifyPageProperties(page),
      }));

    return {
      pages,
      has_more: response.has_more,
      total_count: pages.length,
    };
  },
);
