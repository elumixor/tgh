import type { Context } from "grammy";
import { gramjsClient } from "../gramjs-client";
import { logger } from "../logger";
import { safeEditMessageTextFromContext } from "../telegram-utils";
import type { Tool } from "./types";

export const searchMessagesTool: Tool = {
  definition: {
    name: "search_messages",
    description:
      "Search for messages in the current Telegram chat using keywords. Use when user asks to find, search, or look up past messages.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords to search for in messages",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10, max: 50)",
          minimum: 1,
          maximum: 50,
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput, context) => {
    const query = toolInput.query as string;
    const limit = (toolInput.limit as number | undefined) ?? 10;

    logger.info({ query, limit }, "Message search request received");

    if (context?.telegramCtx && context?.messageId) {
      handleMessageSearch({ query, limit }, context.telegramCtx, context.messageId).catch((error) =>
        logger.error({ query, error: error instanceof Error ? error.message : error }, "Message search failed"),
      );
    }

    return `Searching for messages containing "${query}"...`;
  },
};

async function handleMessageSearch(params: { query: string; limit: number }, ctx: Context, messageId: number) {
  let lastText: string | undefined;

  try {
    lastText = await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `🔍 Searching for messages containing "${params.query}"...`,
    );

    const results = await gramjsClient.searchMessages({ query: params.query, limit: params.limit });

    if (results.length === 0) {
      await safeEditMessageTextFromContext(ctx, messageId, `🔍 No messages found for "${params.query}"`, lastText);
      return;
    }

    const resultText = results
      .map((msg, i) => {
        const dateStr = msg.date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const preview = msg.text.length > 100 ? `${msg.text.slice(0, 100)}...` : msg.text;
        return `${i + 1}. [${dateStr}] ${preview}`;
      })
      .join("\n\n");

    const finalMessage = `🔍 Found ${results.length} message${results.length > 1 ? "s" : ""} for "${params.query}":\n\n${resultText}`;

    await safeEditMessageTextFromContext(ctx, messageId, finalMessage, lastText);

    logger.info({ query: params.query, count: results.length }, "Message search completed");
  } catch (error) {
    logger.error(
      { query: params.query, error: error instanceof Error ? error.message : error },
      "Message search failed",
    );
    await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastText,
    );
  }
}
