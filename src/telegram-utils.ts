import type { Api, Context } from "grammy";
import { logger } from "./logger";

export async function safeEditMessageText(
  api: Api,
  chatId: number,
  messageId: number,
  newText: string,
  lastText?: string,
): Promise<string> {
  if (newText === lastText) return lastText;

  try {
    await api.editMessageText(chatId, messageId, newText);
    return newText;
  } catch (error) {
    logger.debug({ error: error instanceof Error ? error.message : error, messageId }, "Failed to update message");
    return lastText || newText;
  }
}

export async function safeEditMessageTextFromContext(
  ctx: Context,
  messageId: number,
  newText: string,
  lastText?: string,
): Promise<string> {
  const chatId = ctx.chat?.id ?? 0;
  return safeEditMessageText(ctx.api, chatId, messageId, newText, lastText);
}
