import { env } from "env";
import type { Bot, Context } from "grammy";
import { logger } from "logger";
import { transcribeVoice } from "services/transcription";
import { Input } from "./input";
import type { FileData, Message } from "./types";

export interface TelegramMessage extends Message {
  ctx: Context;
  messageId: number;
  chatId: number;
  threadId?: number;
}

export class TelegramInput extends Input {
  private botUsername = "";

  constructor(private readonly bot: Bot) {
    super();
  }

  /**
   * Start listening for Telegram messages
   */
  async start(): Promise<void> {
    const me = await this.bot.api.getMe();
    this.botUsername = me.username ?? "";
    logger.info({ username: me.username, userId: me.id }, "TelegramInput initialized");

    this.bot.on("message", async (ctx) => {
      try {
        await this.handleMessage(ctx);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "Error handling Telegram message");
      }
    });
  }

  private async handleMessage(ctx: Context): Promise<void> {
    if (!ctx.message || !ctx.chat) return;

    const isGroupChat = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    // Authorization checks
    if (isGroupChat) {
      if (ctx.chat.id !== env.ALLOWED_CHAT_ID) return;
      if (!this.isBotMentioned(ctx)) return;
      logger.info({ username: ctx.from?.username, userId: ctx.from?.id }, "Received mention in group");
    } else if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

    // Extract message data
    const message = await this.extractMessage(ctx, ctx.message);
    if (!message.text && !message.files?.length) return;

    logger.info(
      {
        messageId: ctx.message.message_id,
        text: message.text,
        hasFiles: !!message.files?.length,
        hasReference: !!message.referencesMessage,
      },
      "Received message",
    );

    this.emit(message);
  }

  private async extractMessage(ctx: Context, msg: NonNullable<Context["message"]>): Promise<TelegramMessage> {
    let text = msg.text ?? msg.caption ?? "";
    const files: FileData[] = [];

    // Handle voice messages - transcribe to text
    if (msg.voice) {
      const transcription = await transcribeVoice(ctx.api, msg.voice.file_id);
      if (transcription) text = transcription;
    }

    // Handle photos
    if (msg.photo && msg.photo.length > 0) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      if (largestPhoto) {
        const fileData = await this.downloadFile(ctx, largestPhoto.file_id, "image/jpeg");
        if (fileData) files.push(fileData);
      }
    }

    // Handle documents (including images sent as files)
    if (msg.document) {
      const mimeType = msg.document.mime_type ?? "application/octet-stream";
      const fileData = await this.downloadFile(ctx, msg.document.file_id, mimeType, msg.document.file_name);
      if (fileData) files.push(fileData);
    }

    // Handle referenced message (reply)
    let referencesMessage: TelegramMessage | undefined;
    if (msg.reply_to_message) {
      // Cast is safe - we've already verified we're not in a channel
      referencesMessage = await this.extractMessage(
        ctx,
        msg.reply_to_message as unknown as NonNullable<Context["message"]>,
      );
    }

    return {
      text,
      files: files.length > 0 ? files : undefined,
      referencesMessage,
      ctx,
      messageId: msg.message_id,
      chatId: ctx.chat?.id ?? 0,
      threadId: msg.message_thread_id,
    };
  }

  private async downloadFile(
    ctx: Context,
    fileId: string,
    mimeType: string,
    filename?: string,
  ): Promise<FileData | undefined> {
    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) return undefined;

      const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      return { buffer, mimeType, filename };
    } catch (error) {
      logger.error({ fileId, error: error instanceof Error ? error.message : error }, "Failed to download file");
      return undefined;
    }
  }

  private isBotMentioned(ctx: Context): boolean {
    if (!ctx.message) return false;

    const text = ctx.message.text ?? ctx.message.caption ?? "";
    const entities = ctx.message.entities ?? ctx.message.caption_entities ?? [];

    for (const entity of entities) {
      if (entity.type === "mention") {
        const mention = text.substring(entity.offset, entity.offset + entity.length);
        if (mention.toLowerCase() === `@${this.botUsername.toLowerCase()}`) return true;
      }
    }

    return false;
  }
}
