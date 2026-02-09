import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { env } from "env";
import { notion } from "services/notion";

const SKILLS_FILE = "./cache/skills.json";
const DB_ID = env.NOTION_SKILLS_DB_ID;

interface SkillMeta {
  id: string;
  name: string;
  description: string;
}

class Skills {
  private cache: SkillMeta[] | null = null;
  private initPromise: { promise: Promise<void>; resolve: () => void; reject: (reason?: unknown) => void } | null =
    null;

  getAll(): SkillMeta[] {
    if (this.cache !== null) return this.cache;

    if (!existsSync(SKILLS_FILE)) {
      mkdirSync("./cache", { recursive: true });
      writeFileSync(SKILLS_FILE, "[]", "utf-8");
      this.cache = [];
      return [];
    }

    this.cache = JSON.parse(readFileSync(SKILLS_FILE, "utf-8")) as SkillMeta[];
    return this.cache;
  }

  async getByName(name: string): Promise<SkillMeta | undefined> {
    if (!this.initPromise) throw new Error("Skills not initialized. Call sync() first.");
    await this.initPromise.promise;
    return this.getAll().find((s) => s.name === name);
  }

  readContent(pageId: string): Promise<string> {
    return notion.getPageContents(pageId);
  }

  async add(name: string, description: string, content: string): Promise<SkillMeta> {
    const blocks = this.markdownToNotionBlocks(content);
    const id = await notion.createPage(
      DB_ID,
      {
        Name: { title: [{ text: { content: name } }] },
        Description: { rich_text: [{ text: { content: description } }] },
      },
      blocks.nonEmpty ? blocks : undefined,
    );

    await this.refreshCache();
    return { id, name, description };
  }

  async remove(pageId: string): Promise<void> {
    await notion.updatePage(pageId, { archived: true });
    await this.refreshCache();
  }

  async update(pageId: string, updates: { name?: string; description?: string; content?: string }): Promise<void> {
    const properties: Record<string, unknown> = {};
    if (updates.name) properties.Name = { title: [{ text: { content: updates.name } }] };
    if (updates.description) properties.Description = { rich_text: [{ text: { content: updates.description } }] };

    if (Object.keys(properties).length > 0) await notion.updatePage(pageId, { properties });

    if (updates.content) {
      const blocks = this.markdownToNotionBlocks(updates.content);
      await notion.replacePageContents(pageId, blocks);
    }

    await this.refreshCache();
  }

  async sync(): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.initPromise = { promise, resolve, reject };
    try {
      const skills = await this.queryDatabase();
      this.saveCache(skills);
      resolve();
      return `Skills synced: ${skills.length} skill(s) loaded`;
    } catch (e) {
      reject(e);
      throw e;
    }
  }

  getPromptSection(): string {
    const all = this.getAll();
    if (all.length === 0) return "";

    const list = all.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
    return `\n## Skills\n\nYou have the following skills available. Use ReadSkill to read the full content of a skill when needed.\n\n${list}\n\n.`;
  }

  private async refreshCache(): Promise<void> {
    const skills = await this.queryDatabase();
    this.saveCache(skills);
  }

  private async queryDatabase(): Promise<SkillMeta[]> {
    // SDK v5 removed databases.query — use raw API
    const response = (await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: "{}",
    }).then((r) => r.json())) as { results: Array<{ id: string; properties: Record<string, unknown> }> };

    const skills: SkillMeta[] = [];

    for (const page of response.results) {
      const props = page.properties;

      const nameProperty = props.Name as { title?: Array<{ plain_text?: string }> } | undefined;
      const rawName = nameProperty?.title?.map((t) => t.plain_text ?? "").join("") ?? "";
      if (!rawName) continue;

      const descProperty = props.Description as { rich_text?: Array<{ plain_text?: string }> } | undefined;
      const description = descProperty?.rich_text?.map((t) => t.plain_text ?? "").join("") ?? "";

      skills.push({ id: page.id, name: rawName, description });
    }

    return skills;
  }

  private saveCache(skills: SkillMeta[]): void {
    this.cache = skills;
    mkdirSync("./cache", { recursive: true });
    writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2), "utf-8");
  }

  private markdownToNotionBlocks(markdown: string): BlockObjectRequest[] {
    const lines = markdown.split("\n");
    const blocks: BlockObjectRequest[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.startsWith("### ")) {
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: [{ type: "text", text: { content: line.slice(4) } }] },
        });
      } else if (line.startsWith("## ")) {
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3) } }] },
        });
      } else if (line.startsWith("# ")) {
        blocks.push({
          object: "block",
          type: "heading_1",
          heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
        });
      } else if (line.startsWith("- ")) {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] },
        });
      } else {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
        });
      }
    }

    return blocks;
  }
}

export const skills = new Skills();
