import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { env } from "env";
import { notionClient } from "services/notion";

const SKILLS_FILE = "./cache/skills.json";
const DB_ID = env.NOTION_SKILLS_DB_ID;

interface SkillMeta {
  id: string;
  name: string;
  description: string;
}

function toCamelCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

class Skills {
  private cache: SkillMeta[] | null = null;

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

  getByName(name: string): SkillMeta | undefined {
    return this.getAll().find((s) => s.name === name);
  }

  async readContent(pageId: string): Promise<string> {
    const blocks = await notionClient.blocks.children.list({ block_id: pageId, page_size: 100 });
    const lines: string[] = [];

    for (const block of blocks.results) {
      if (!("type" in block)) continue;
      const blockType = block.type;
      const blockData = block as Record<string, unknown>;
      const typedBlock = blockData[blockType] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
      const text = typedBlock?.rich_text?.map((t) => t.plain_text ?? "").join("") ?? "";

      switch (blockType) {
        case "heading_1":
          lines.push(`# ${text}`);
          break;
        case "heading_2":
          lines.push(`## ${text}`);
          break;
        case "heading_3":
          lines.push(`### ${text}`);
          break;
        case "bulleted_list_item":
          lines.push(`- ${text}`);
          break;
        case "paragraph":
          lines.push(text);
          break;
      }
    }

    return lines.join("\n");
  }

  async add(name: string, description: string, content: string): Promise<SkillMeta> {
    const page = await notionClient.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        Name: { title: [{ text: { content: name } }] },
        Description: { rich_text: [{ text: { content: description } }] },
      },
    });

    const blocks = this.markdownToNotionBlocks(content);
    if (blocks.length > 0) await notionClient.blocks.children.append({ block_id: page.id, children: blocks });

    await this.refreshCache();
    return { id: page.id, name: toCamelCase(name), description };
  }

  async remove(pageId: string): Promise<void> {
    await notionClient.pages.update({ page_id: pageId, archived: true });
    await this.refreshCache();
  }

  async update(pageId: string, updates: { name?: string; description?: string; content?: string }): Promise<void> {
    const properties: Record<
      string,
      { title: Array<{ text: { content: string } }> } | { rich_text: Array<{ text: { content: string } }> }
    > = {};
    if (updates.name) properties.Name = { title: [{ text: { content: updates.name } }] };
    if (updates.description) properties.Description = { rich_text: [{ text: { content: updates.description } }] };

    if (Object.keys(properties).length > 0) await notionClient.pages.update({ page_id: pageId, properties });

    if (updates.content) {
      const existing = await notionClient.blocks.children.list({ block_id: pageId, page_size: 100 });
      for (const block of existing.results) await notionClient.blocks.delete({ block_id: block.id });

      const blocks = this.markdownToNotionBlocks(updates.content);
      if (blocks.length > 0) await notionClient.blocks.children.append({ block_id: pageId, children: blocks });
    }

    await this.refreshCache();
  }

  async sync(): Promise<string> {
    const skills = await this.queryDatabase();
    this.saveCache(skills);
    return `Skills synced: ${skills.length} skill(s) loaded`;
  }

  getPromptSection(): string {
    const all = this.getAll();
    if (all.length === 0) return "";

    const list = all.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
    return `\n## Skills\n\nYou have the following skills available. Use ReadSkill to read the full content of a skill when needed.\n\n${list}\n\nUse AddSkill, RemoveSkill, UpdateSkill to manage skills.`;
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

      skills.push({ id: page.id, name: toCamelCase(rawName), description });
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
