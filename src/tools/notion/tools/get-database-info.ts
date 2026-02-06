import { notionClient } from "services/notion";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getDatabaseInfoTool = defineTool(
  "GetDatabaseInfo",
  "Get metadata about a Notion database including its schema (properties and their types). Use this to understand what fields are available before querying or creating pages.",
  z.object({
    database_id: z.string().describe("The ID of the Notion database to retrieve"),
  }),
  async ({ database_id }, _context) => {
    const database = await notionClient.databases.retrieve({ database_id });

    if (!("properties" in database)) throw new Error("Database response missing properties");

    const properties = Object.entries(database.properties as Record<string, { type: string; id: string }>).map(
      ([name, prop]) => ({
        name,
        type: prop.type,
        id: prop.id,
      }),
    );

    return {
      id: database.id,
      title: "title" in database ? database.title.map((t) => ("plain_text" in t ? t.plain_text : "")).join("") : "",
      url: "url" in database ? database.url : "",
      properties,
    };
  },
);
