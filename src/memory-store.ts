import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { DocumentWithEmbedding } from "./embeddings";
import { embeddingsService } from "./embeddings";
import { env } from "./env";
import { logger } from "./logger";

export interface Memory {
  id: string;
  content: string;
  embedding: number[];
  timestamp: string;
  url: string;
  similarity?: number;
}

export class MemoryStore {
  private readonly client = new Client({ auth: env.NOTION_API_KEY });
  private readonly databaseId = env.NOTION_DATABASE_ID;
  private memoryCache: Memory[] | null = null;
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  async loadMemories(): Promise<Memory[]> {
    logger.debug("Loading memories from Notion");

    const memories: Memory[] = [];
    let cursor: string | undefined;

    do {
      const response = await fetch(`https://api.notion.com/v1/databases/${this.databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_cursor: cursor,
          page_size: 100,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as {
        results: unknown[];
        has_more: boolean;
        next_cursor: string | null;
      };

      for (const result of data.results) {
        if (!result || typeof result !== "object" || !("url" in result)) continue;

        const page = result as PageObjectResponse;
        const content = this.extractContent(page);
        const embedding = this.extractEmbedding(page);

        if (content && embedding) {
          memories.push({
            id: page.id,
            content,
            embedding,
            timestamp: page.created_time,
            url: page.url,
          });
        }
      }

      cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
    } while (cursor);

    logger.info({ count: memories.length }, "Loaded memories from Notion");
    this.memoryCache = memories;
    this.lastCacheUpdate = new Date();

    return memories;
  }

  async searchMemories(query: string, topK = 5): Promise<Memory[]> {
    logger.debug({ query, topK }, "Searching memories");

    await this.ensureFreshCache();

    if (!this.memoryCache || this.memoryCache.length === 0) {
      logger.info("No memories in cache");
      return [];
    }

    const queryEmbedding = await embeddingsService.createEmbedding(query);

    const documents: DocumentWithEmbedding[] = this.memoryCache.map((m) => ({
      id: m.id,
      content: m.content,
      embedding: m.embedding,
    }));

    const results = embeddingsService.findMostSimilar(queryEmbedding, documents, topK);

    return results
      .map((result) => {
        const memory = this.memoryCache?.find((m) => m.id === result.id);
        if (!memory) return null;
        return { ...memory, similarity: result.similarity } as Memory;
      })
      .filter((m): m is Memory & { similarity: number } => m !== null);
  }

  async addMemory(content: string): Promise<string> {
    logger.debug({ contentLength: content.length }, "Adding memory");

    const embedding = await embeddingsService.createEmbedding(content);
    const pageId = await this.createNotionMemory(content, embedding);

    this.memoryCache = null;

    logger.info({ pageId }, "Memory added");
    return pageId;
  }

  async updateMemory(pageId: string, newContent: string): Promise<void> {
    logger.debug({ pageId, contentLength: newContent.length }, "Updating memory");

    const embedding = await embeddingsService.createEmbedding(newContent);

    await this.client.pages.update({
      page_id: pageId,
      properties: {
        Name: {
          title: [{ text: { content: newContent.substring(0, 50) } }],
        },
        Content: {
          rich_text: [{ text: { content: newContent } }],
        },
        Embedding: {
          rich_text: [{ text: { content: this.embeddingToProperty(embedding) } }],
        },
      },
    });

    this.memoryCache = null;

    logger.info({ pageId }, "Memory updated");
  }

  async getMemory(pageId: string): Promise<Memory | null> {
    logger.debug({ pageId }, "Getting memory");

    try {
      const page = (await this.client.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
      const content = this.extractContent(page);
      const embedding = this.extractEmbedding(page);

      if (!content || !embedding) return null;

      return {
        id: page.id,
        content,
        embedding,
        timestamp: page.created_time,
        url: page.url,
      };
    } catch (error) {
      logger.error({ pageId, error: error instanceof Error ? error.message : error }, "Failed to get memory");
      return null;
    }
  }

  private async createNotionMemory(content: string, embedding: number[]): Promise<string> {
    const title = content.substring(0, 50);

    const response = await this.client.pages.create({
      parent: { database_id: this.databaseId },
      properties: {
        Name: {
          title: [{ text: { content: title } }],
        },
        Content: {
          rich_text: [{ text: { content } }],
        },
        Embedding: {
          rich_text: [{ text: { content: this.embeddingToProperty(embedding) } }],
        },
      },
    });

    return response.id;
  }

  private embeddingToProperty(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  private propertyToEmbedding(property: string): number[] | null {
    try {
      const parsed = JSON.parse(property) as number[];
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private extractContent(page: PageObjectResponse): string | null {
    const contentProp = page.properties.Content;
    if (contentProp?.type === "rich_text" && contentProp.rich_text.length > 0) {
      return contentProp.rich_text.map((text) => text.plain_text).join("");
    }
    return null;
  }

  private extractEmbedding(page: PageObjectResponse): number[] | null {
    const embeddingProp = page.properties.Embedding;
    if (embeddingProp?.type === "rich_text" && embeddingProp.rich_text.length > 0) {
      const embeddingStr = embeddingProp.rich_text.map((text) => text.plain_text).join("");
      return this.propertyToEmbedding(embeddingStr);
    }
    return null;
  }

  private async ensureFreshCache(): Promise<void> {
    if (this.memoryCache && this.lastCacheUpdate) {
      const age = Date.now() - this.lastCacheUpdate.getTime();
      if (age < this.CACHE_TTL_MS) {
        logger.debug({ ageMs: age }, "Using cached memories");
        return;
      }
    }

    logger.debug("Cache stale or empty, reloading");
    await this.loadMemories();
  }
}

export const memoryStore = new MemoryStore();
