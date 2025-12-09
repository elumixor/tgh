import type { Tool } from "agents/agent";
import type { Context } from "grammy";
import { logger } from "logger";
import { webSearch } from "services/perplexity";
import { sendLongMessage } from "services/telegram";
import { createProgressHandler } from "utils/progress-handler";

export const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description:
      "Search the web for current information using Perplexity AI. Use when user asks questions that require up-to-date information, facts, news, or real-world data not in your knowledge base. Returns comprehensive answers with citations from recent web sources.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or question to ask. Be specific and clear.",
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput, context) => {
    const query = toolInput.query as string;
    logger.info({ query }, "Web search request received");

    if (context?.telegramCtx && context?.messageId) {
      return await handleWebSearch(query, context.telegramCtx, context.messageId);
    }

    return await webSearch(query);
  },
};

async function handleWebSearch(query: string, ctx: Context, messageId: number) {
  const progress = createProgressHandler(ctx, messageId);

  try {
    await progress.updateProgress({ text: "🔍 Searching the web..." });
    const result = await webSearch(query);

    await sendLongMessage(ctx.api, `🔍 Web Search Results\n\n${result}`, {
      chatId: ctx.chat?.id ?? 0,
      threadId: ctx.message?.message_thread_id,
    });

    return result;
  } catch (error) {
    logger.error({ query, error: error instanceof Error ? error.message : error }, "Web search failed in handler");
    await progress.showError(`Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  }
}
