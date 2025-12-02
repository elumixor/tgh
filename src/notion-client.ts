import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { env } from "./env";
import { logger } from "./logger";

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
}

export interface NotionPageContent {
  id: string;
  title: string;
  content: string;
  url: string;
}

export interface NotionDatabaseQuery {
  results: NotionPage[];
  hasMore: boolean;
  nextCursor?: string;
}

export class NotionClient {
  private readonly client = new Client({ auth: env.NOTION_API_KEY });

  async searchPages(query: string, limit = 10): Promise<NotionPage[]> {
    logger.debug({ query, limit }, "Searching Notion pages");

    const response = await this.client.search({
      query,
      filter: { property: "object", value: "page" },
      page_size: limit,
    });

    const pages = response.results
      .filter((result) => "url" in result)
      .map((result) => {
        const page = result as PageObjectResponse;
        return {
          id: page.id,
          title: this.extractTitle(page),
          url: page.url,
          lastEditedTime: page.last_edited_time,
        };
      });

    logger.debug({ count: pages.length }, "Found Notion pages");
    return pages;
  }

  async getPageContent(pageId: string): Promise<NotionPageContent> {
    logger.debug({ pageId }, "Getting Notion page content");

    const page = (await this.client.pages.retrieve({ page_id: pageId })) as PageObjectResponse;
    const blocks = await this.getAllBlocks(pageId);
    const content = this.blocksToMarkdown(blocks);

    return {
      id: page.id,
      title: this.extractTitle(page),
      content,
      url: page.url,
    };
  }

  async queryDatabase(databaseId: string, filters?: unknown, limit = 10): Promise<NotionDatabaseQuery> {
    logger.debug({ databaseId, limit }, "Querying Notion database");

    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: filters,
        page_size: limit,
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

    const pages = data.results
      .filter((result: unknown) => result && typeof result === "object" && "url" in result)
      .map((result: unknown) => {
        const page = result as PageObjectResponse;
        return {
          id: page.id,
          title: this.extractTitle(page),
          url: page.url,
          lastEditedTime: page.last_edited_time,
        };
      });

    return {
      results: pages,
      hasMore: data.has_more,
      nextCursor: data.next_cursor ?? undefined,
    };
  }

  private async getAllBlocks(blockId: string): Promise<BlockObjectResponse[]> {
    const blocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if ("type" in block) {
          blocks.push(block as BlockObjectResponse);

          if (block.has_children) {
            const children = await this.getAllBlocks(block.id);
            blocks.push(...children);
          }
        }
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return blocks;
  }

  private blocksToMarkdown(blocks: (BlockObjectResponse | PartialBlockObjectResponse)[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      if (!("type" in block)) continue;

      const blockObj = block as BlockObjectResponse;
      const { type } = blockObj;

      switch (type) {
        case "paragraph":
          lines.push(this.richTextToPlainText(blockObj.paragraph.rich_text));
          lines.push("");
          break;

        case "heading_1":
          lines.push(`# ${this.richTextToPlainText(blockObj.heading_1.rich_text)}`);
          lines.push("");
          break;

        case "heading_2":
          lines.push(`## ${this.richTextToPlainText(blockObj.heading_2.rich_text)}`);
          lines.push("");
          break;

        case "heading_3":
          lines.push(`### ${this.richTextToPlainText(blockObj.heading_3.rich_text)}`);
          lines.push("");
          break;

        case "bulleted_list_item":
          lines.push(`- ${this.richTextToPlainText(blockObj.bulleted_list_item.rich_text)}`);
          break;

        case "numbered_list_item":
          lines.push(`1. ${this.richTextToPlainText(blockObj.numbered_list_item.rich_text)}`);
          break;

        case "to_do":
          {
            const checked = blockObj.to_do.checked ? "[x]" : "[ ]";
            lines.push(`- ${checked} ${this.richTextToPlainText(blockObj.to_do.rich_text)}`);
          }
          break;

        case "code":
          lines.push(`\`\`\`${blockObj.code.language || ""}`);
          lines.push(this.richTextToPlainText(blockObj.code.rich_text));
          lines.push("```");
          lines.push("");
          break;

        case "quote":
          lines.push(`> ${this.richTextToPlainText(blockObj.quote.rich_text)}`);
          lines.push("");
          break;

        case "divider":
          lines.push("---");
          lines.push("");
          break;

        case "callout":
          {
            const icon = blockObj.callout.icon?.type === "emoji" ? `${blockObj.callout.icon.emoji} ` : "";
            lines.push(`> ${icon}${this.richTextToPlainText(blockObj.callout.rich_text)}`);
            lines.push("");
          }
          break;
      }
    }

    return lines.join("\n").trim();
  }

  private richTextToPlainText(richText: RichTextItemResponse[]): string {
    return richText.map((text) => text.plain_text).join("");
  }

  private extractTitle(page: PageObjectResponse): string {
    const titleProperty = Object.values(page.properties).find((prop) => prop.type === "title");

    if (titleProperty && titleProperty.type === "title") {
      return this.richTextToPlainText(titleProperty.title);
    }

    return "Untitled";
  }
}

export const notionClient = new NotionClient();
