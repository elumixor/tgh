import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import { env } from "env";
import { logger } from "logger";
import { notion } from "services/notion";

const MEMORIES_FILE = "./cache/memories.md";
const NOTION_PAGE_ID = env.NOTION_MEMORIES_PAGE_ID;

class Memories {
  private cache: string | null = null;
  private syncQueue: Promise<void> = Promise.resolve();

  /** Get current memories (loads from file if not cached) */
  get(): string {
    if (this.cache !== null) return this.cache;

    if (!existsSync(MEMORIES_FILE)) {
      mkdirSync("./cache", { recursive: true });
      writeFileSync(MEMORIES_FILE, "", "utf-8");
      this.cache = "";
      return "";
    }

    this.cache = readFileSync(MEMORIES_FILE, "utf-8");
    return this.cache;
  }

  /** Save memories to file and queue Notion sync */
  save(content: string): void {
    this.cache = content;
    writeFileSync(MEMORIES_FILE, content, "utf-8");
    // Queue Notion sync (non-blocking, runs in background)
    this.queueSync(content);
  }

  /** Sync memories between local file and Notion (bidirectional). Returns status message. */
  async sync(): Promise<string> {
    const localTime = this.getLocalFileTime();
    const notionTime = await this.getNotionPageTime();

    if (!localTime && !notionTime) {
      mkdirSync("./cache", { recursive: true });
      writeFileSync(MEMORIES_FILE, "", "utf-8");
      return "No memories found, created empty file";
    }

    if (!localTime) {
      const content = await this.readFromNotion();
      mkdirSync("./cache", { recursive: true });
      writeFileSync(MEMORIES_FILE, content, "utf-8");
      this.cache = content;
      return "Memories synced: Notion → local";
    }

    if (!notionTime) {
      const content = readFileSync(MEMORIES_FILE, "utf-8");
      await this.syncToNotion(content);
      return "Memories synced: local → Notion";
    }

    if (notionTime > localTime) {
      const content = await this.readFromNotion();
      writeFileSync(MEMORIES_FILE, content, "utf-8");
      this.cache = content;
      return "Memories synced: Notion → local (Notion was newer)";
    }

    if (localTime > notionTime) {
      const content = readFileSync(MEMORIES_FILE, "utf-8");
      await this.syncToNotion(content);
      return "Memories synced: local → Notion (local was newer)";
    }

    return "Memories already in sync";
  }

  /** Queue a Notion sync operation */
  private queueSync(content: string): void {
    this.syncQueue = this.syncQueue
      .then(async () => {
        await this.syncToNotion(content);
        logger.info("Memories synced: queued → Notion");
      })
      .catch((error) => {
        logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to sync memories to Notion");
      });
  }

  /** Get the local file's last modification time */
  private getLocalFileTime(): Date | null {
    if (!existsSync(MEMORIES_FILE)) return null;
    return statSync(MEMORIES_FILE).mtime;
  }

  /** Get the Notion page's last edited time */
  private async getNotionPageTime(): Promise<Date | null> {
    try {
      const { lastEditedTime } = await notion.getPageMeta(NOTION_PAGE_ID);
      if (lastEditedTime) return new Date(lastEditedTime);
      return null;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to get Notion page time");
      return null;
    }
  }

  /** Read content from Notion page */
  private readFromNotion(): Promise<string> {
    return notion.getPageContents(NOTION_PAGE_ID);
  }

  /** Sync memories content to Notion page */
  private async syncToNotion(content: string): Promise<void> {
    const blocks = this.markdownToNotionBlocks(content);
    await notion.replacePageContents(NOTION_PAGE_ID, blocks);
  }

  /** Convert markdown content to Notion blocks */
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

export const memories = new Memories();
