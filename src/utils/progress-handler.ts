import { type Context, InputFile } from "grammy";
import { logger } from "logger";
import { safeEditMessageTextFromContext, sendLongMessage } from "services/telegram";

interface ProgressUpdate {
  text: string;
}

interface FileToSend {
  data: Buffer;
  filename: string;
  caption?: string;
}

export class ProgressHandler {
  private lastText?: string;

  constructor(
    private readonly ctx: Context,
    private readonly messageId: number,
    private readonly chatId: number,
    private readonly threadId?: number,
    private readonly replyToMessageId?: number,
  ) {}

  async updateProgress(update: ProgressUpdate): Promise<void> {
    this.lastText = await safeEditMessageTextFromContext(this.ctx, this.messageId, update.text, this.lastText);
  }

  async sendPhotoAndFile(params: {
    imageData: Buffer;
    photoCaption: string;
    filename: string;
    fileCaption?: string;
  }): Promise<void> {
    await this.ctx.replyWithChatAction("upload_photo");

    const photoMessage = await this.ctx.api.sendPhoto(this.chatId, new InputFile(params.imageData, "photo.png"), {
      caption: params.photoCaption,
      message_thread_id: this.threadId,
      reply_parameters: this.replyToMessageId ? { message_id: this.replyToMessageId } : undefined,
    });

    await this.deleteProgressMessage();

    await this.ctx.replyWithChatAction("upload_document");

    await this.ctx.api.sendDocument(this.chatId, new InputFile(params.imageData, params.filename), {
      caption: params.fileCaption,
      reply_parameters: { message_id: photoMessage.message_id },
      message_thread_id: this.threadId,
    });
  }

  async sendMultiplePhotosAndFiles(params: {
    items: Array<{ imageData: Buffer; photoCaption: string; filename: string; fileCaption?: string }>;
  }): Promise<void> {
    for (let i = 0; i < params.items.length; i++) {
      const item = params.items[i];
      if (!item) continue;

      await this.ctx.replyWithChatAction("upload_photo");

      const photoMessage = await this.ctx.api.sendPhoto(this.chatId, new InputFile(item.imageData, "photo.png"), {
        caption: item.photoCaption,
        message_thread_id: this.threadId,
        reply_parameters: this.replyToMessageId && i === 0 ? { message_id: this.replyToMessageId } : undefined,
      });

      if (i === 0) await this.deleteProgressMessage();

      await this.ctx.replyWithChatAction("upload_document");

      await this.ctx.api.sendDocument(this.chatId, new InputFile(item.imageData, item.filename), {
        caption: item.fileCaption,
        reply_parameters: { message_id: photoMessage.message_id },
        message_thread_id: this.threadId,
      });

      if (i < params.items.length - 1) await this.ctx.replyWithChatAction("upload_photo");
    }
  }

  async sendFiles(params: { files: FileToSend[] }): Promise<void> {
    for (let i = 0; i < params.files.length; i++) {
      const file = params.files[i];
      if (!file) continue;

      await this.ctx.replyWithChatAction("upload_document");

      await this.ctx.api.sendDocument(this.chatId, new InputFile(file.data, file.filename), {
        caption: file.caption,
        message_thread_id: this.threadId,
      });

      if (i === 0) await this.deleteProgressMessage();

      if (i < params.files.length - 1) await this.ctx.replyWithChatAction("upload_document");
    }
  }

  async sendFinalMessage(text: string): Promise<void> {
    await sendLongMessage(this.ctx.api, text, { chatId: this.chatId, threadId: this.threadId });
  }

  async showError(errorMessage: string): Promise<void> {
    await safeEditMessageTextFromContext(this.ctx, this.messageId, `❌ ${errorMessage}`, this.lastText);
  }

  private async deleteProgressMessage(): Promise<void> {
    try {
      await this.ctx.api.deleteMessage(this.chatId, this.messageId);
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : error }, "Failed to delete progress message");
    }
  }
}

export function createProgressHandler(ctx: Context, messageId: number): ProgressHandler {
  const chatId = ctx.chat?.id ?? 0;
  const threadId = ctx.message?.message_thread_id;
  const replyToMessageId = ctx.message?.message_id;
  return new ProgressHandler(ctx, messageId, chatId, threadId, replyToMessageId);
}
