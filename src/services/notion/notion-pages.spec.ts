import { describe, expect, test } from "bun:test";
import { env } from "env";
import { notionClient } from "services/notion";

async function queryDatabase(databaseId: string) {
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(res.ok).toBe(true);
  return (await res.json()) as { results: unknown[] };
}

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("Notion pages and databases (manual)", () => {
  test("Memories page is accessible", async () => {
    const page = await notionClient.pages.retrieve({ page_id: env.NOTION_MEMORIES_PAGE_ID });
    expect(page).toBeDefined();
    expect(page.id).toBeTruthy();
  });

  test("People DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_PEOPLE_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Roles DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_ROLES_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Sensitive Data DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_SENSITIVE_DATA_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Tasks DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_TASKS_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Hypocrisy DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_HYPOCRISY_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Skills DB is accessible", async () => {
    const db = await notionClient.databases.retrieve({ database_id: env.NOTION_SKILLS_DB_ID });
    expect(db).toBeDefined();
    expect(db.id).toBeTruthy();
  });

  test("Skills DB is queryable", async () => {
    const result = await queryDatabase(env.NOTION_SKILLS_DB_ID);
    console.log(result);
    expect(result).toBeDefined();
    expect(result.results).toBeArray();
  });
});
