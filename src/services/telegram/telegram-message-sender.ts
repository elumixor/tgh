import type { Api, Context } from "grammy";
import { logger } from "logger";
import { markdownToTelegramHtml } from "utils";
import { splitMessage } from "./telegram-message-splitter";

interface SendOptions {
  chatId: number;
  threadId?: number;
  replyToMessageId?: number;
}

export async function sendLongMessage(api: Api, text: string, options: SendOptions): Promise<void> {
  const htmlText = markdownToTelegramHtml(text);
  const chunks = splitMessage(htmlText);

  let previousMessageId = options.replyToMessageId;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    const sendOptions: {
      message_thread_id?: number;
      reply_parameters?: { message_id: number };
      parse_mode: "HTML";
    } = { parse_mode: "HTML" };

    if (options.threadId) sendOptions.message_thread_id = options.threadId;
    if (previousMessageId) sendOptions.reply_parameters = { message_id: previousMessageId };

    try {
      const sentMessage = await api.sendMessage(options.chatId, chunk.text, sendOptions);
      previousMessageId = sentMessage.message_id;

      if (i < chunks.length - 1) await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : error, chunkIndex: i },
        "Failed to send message chunk",
      );
      throw error;
    }
  }
}

export async function replyWithLongMessage(
  ctx: Context,
  text: string,
  replyOptions?: { reply_parameters: { message_id: number }; message_thread_id?: number },
): Promise<void> {
  const chatId = ctx.chat?.id ?? 0;
  const threadId = replyOptions?.message_thread_id;
  const replyToMessageId = replyOptions?.reply_parameters.message_id;

  await sendLongMessage(ctx.api, text, { chatId, threadId, replyToMessageId });
}
