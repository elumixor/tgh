import { describe, expect, test } from "bun:test";
import { env } from "env";
import { notion } from "services/notion";

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("Notion pages and databases (manual)", () => {
  test("Memories page is accessible", async () => {
    const meta = await notion.getPageMeta(env.NOTION_MEMORIES_PAGE_ID);
    expect(meta).toBeDefined();
  });

  test("People DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_PEOPLE_DB_ID);
    expect(db).toBeDefined();
  });

  test("Roles DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_ROLES_DB_ID);
    expect(db).toBeDefined();
  });

  test("Sensitive Data DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_SENSITIVE_DATA_DB_ID);
    expect(db).toBeDefined();
  });

  test("Tasks DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_TASKS_DB_ID);
    expect(db).toBeDefined();
  });

  test("Hypocrisy DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_HYPOCRISY_DB_ID);
    expect(db).toBeDefined();
  });

  test("Skills DB is accessible", async () => {
    const db = await notion.getDatabase(env.NOTION_SKILLS_DB_ID);
    expect(db).toBeDefined();
  });
});
