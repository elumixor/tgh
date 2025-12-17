import { type Context, InputFile } from "grammy";
import type { Block, BlockContent, BlockHandle, FileData, MessageContent, MessageHandle } from "io/types";
import { logger } from "logger";
import { splitMessage } from "services/telegram";
import { markdownToTelegramHtml } from "utils";
import { TelegramBlockHandle } from "./telegram-block-handle";
import { formatBlock, type Operation } from "./telegram-output";

export class TelegramMessageHandle implements MessageHandle {
  private text = this.content.text;
  private lastSentText?: string;
  private messageIds: number[] = [];
  private deleted = false;
  private blocks: Block[] = [];

  private queue: Operation[] = [];
  private processing = false;
  private debounceTimeout?: Timer;
  private readonly replyToMessageId = this.content.replyToMessageId;

  constructor(
    private readonly ctx: Context,
    private readonly content: MessageContent,
    private readonly debounceMs = 500,
  ) {
    void this.sendInitialMessage(content);
  }

  createBlock(content: BlockContent): BlockHandle {
    const block: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.blocks.push(block);
    this.updateBlocksDisplay();
    return new TelegramBlockHandle(block, () => this.updateBlocksDisplay());
  }

  private updateBlocksDisplay(): void {
    this.replaceWith(this.blocks.map((block) => formatBlock(block)).join("\n"));
  }

  append(text: string): void {
    this.enqueue({ type: "append", text });
  }

  addPhoto(file: FileData): void {
    this.enqueue({ type: "addPhoto", file });
  }

  addFile(file: FileData): void {
    this.enqueue({ type: "addFile", file });
  }

  replaceWith(text: string): void {
    this.enqueue({ type: "replaceWith", text });
  }

  clear(): void {
    this.enqueue({ type: "clear" });
  }

  private enqueue(op: Operation): void {
    // For text operations, debounce
    if (op.type === "append" || op.type === "replaceWith") {
      // Apply to local text immediately
      if (op.type === "append") this.text += `\n${op.text}`;
      else this.text = op.text;

      // Clear any pending debounce and set new one
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.queue.push({ type: "replaceWith", text: this.text });
        void this.processQueue();
      }, this.debounceMs);
    } else {
      this.queue.push(op);
      void this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const op = this.queue.shift();
      if (!op) continue;

      try {
        await this.executeOperation(op);
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : error, op: op.type },
          "TelegramOutput: op failed",
        );
      }
    }

    this.processing = false;
  }

  private async executeOperation(op: Operation): Promise<void> {
    if (this.deleted && op.type !== "addPhoto" && op.type !== "addFile") return;

    const chatId = this.ctx.chat?.id;
    const threadId = this.ctx.message?.message_thread_id;
    if (!chatId) return;

    switch (op.type) {
      case "replaceWith": {
        if (op.text === this.lastSentText) break;

        const htmlText = markdownToTelegramHtml(op.text);
        const chunks = splitMessage(htmlText);
        const newMessageIds: number[] = [];

        // Edit existing messages and send new ones as needed
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (!chunk) continue;

          const existingMsgId = this.messageIds[i];
          if (existingMsgId !== undefined) {
            // Edit existing message
            try {
              await this.ctx.api.editMessageText(chatId, existingMsgId, chunk.text, { parse_mode: "HTML" });
            } catch (error) {
              logger.debug({ error: error instanceof Error ? error.message : error }, "Failed to edit message");
            }
            newMessageIds.push(existingMsgId);
          } else {
            // Send new message, replying to the previous one
            const replyTo = i === 0 ? this.replyToMessageId : newMessageIds[i - 1];
            try {
              const sendOptions: {
                message_thread_id?: number;
                reply_parameters?: { message_id: number };
                parse_mode: "HTML";
              } = { parse_mode: "HTML" };
              if (threadId) sendOptions.message_thread_id = threadId;
              if (replyTo) sendOptions.reply_parameters = { message_id: replyTo };

              const msg = await this.ctx.api.sendMessage(chatId, chunk.text, sendOptions);
              newMessageIds.push(msg.message_id);
            } catch (error) {
              logger.error({ error: error instanceof Error ? error.message : error }, "Failed to send new chunk");
            }
          }
        }

        // Delete extra messages if new text has fewer chunks
        for (const msgId of this.messageIds.slice(chunks.length)) {
          try {
            await this.ctx.api.deleteMessage(chatId, msgId);
          } catch (error) {
            logger.debug({ error: error instanceof Error ? error.message : error }, "Failed to delete extra message");
          }
        }

        this.messageIds = newMessageIds;
        this.lastSentText = op.text;
        break;
      }

      case "addPhoto": {
        await this.ctx.api.sendChatAction(chatId, "upload_photo", { message_thread_id: threadId });
        const replyParams = this.replyToMessageId ? { message_id: this.replyToMessageId } : undefined;
        await this.ctx.api.sendPhoto(chatId, new InputFile(op.file.buffer, op.file.filename ?? "photo.png"), {
          message_thread_id: threadId,
          reply_parameters: replyParams,
        });
        break;
      }

      case "addFile": {
        await this.ctx.api.sendChatAction(chatId, "upload_document", { message_thread_id: threadId });
        const replyParams = this.replyToMessageId ? { message_id: this.replyToMessageId } : undefined;
        await this.ctx.api.sendDocument(chatId, new InputFile(op.file.buffer, op.file.filename ?? "file"), {
          message_thread_id: threadId,
          reply_parameters: replyParams,
        });
        break;
      }

      case "clear": {
        for (const msgId of this.messageIds) {
          try {
            await this.ctx.api.deleteMessage(chatId, msgId);
          } catch (error) {
            logger.debug({ error: error instanceof Error ? error.message : error }, "Failed to delete message");
          }
        }
        this.messageIds = [];
        this.deleted = true;
        break;
      }
    }
  }

  private async sendInitialMessage(content: MessageContent): Promise<void> {
    const chatId = this.ctx.chat?.id;
    const threadId = this.ctx.message?.message_thread_id;
    if (!chatId) return;

    try {
      const htmlText = markdownToTelegramHtml(content.text || "...");
      const chunks = splitMessage(htmlText);

      let previousMessageId = this.replyToMessageId;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;

        const sendOptions: {
          message_thread_id?: number;
          reply_parameters?: { message_id: number };
          parse_mode: "HTML";
        } = { parse_mode: "HTML" };
        if (threadId) sendOptions.message_thread_id = threadId;
        if (previousMessageId) sendOptions.reply_parameters = { message_id: previousMessageId };

        const msg = await this.ctx.api.sendMessage(chatId, chunk.text, sendOptions);
        this.messageIds.push(msg.message_id);
        previousMessageId = msg.message_id;

        if (i < chunks.length - 1) await new Promise((resolve) => setTimeout(resolve, 50));
      }

      this.lastSentText = content.text || "...";

      // Send initial files if any
      if (content.files) {
        for (const file of content.files) {
          const isImage = file.mimeType.startsWith("image/");
          if (isImage) this.addPhoto(file);
          else this.addFile(file);
        }
      }
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "TelegramOutput: initial send failed");
    }
  }
}
