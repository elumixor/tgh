import type { Context } from "grammy";
import { splitMessage } from "services/telegram";
import type { ElementNode } from "../../core";
import { serializeTelegram } from "./telegram-serializer";

export class TelegramMessageManager {
  private messageIds: number[] = [];
  private lastSentText?: string;

  constructor(
    private readonly ctx: Context,
    private readonly replyToMessageId?: number,
  ) {}

  private get chatId() {
    const chatId = this.ctx.chat?.id;
    if (!chatId) throw new Error("Chat ID is undefined");
    return chatId;
  }

  async update(node: ElementNode): Promise<void> {
    const html = serializeTelegram(node);
    if (html === this.lastSentText) return;

    const chatId = this.chatId;
    const threadId = this.ctx.message?.message_thread_id;

    const chunks = splitMessage(html);
    const newMessageIds: number[] = [];

    for (const [i, chunk] of chunks.entries()) {
      if (!chunk) continue;

      const existingMsgId = this.messageIds[i];
      if (existingMsgId !== undefined) {
        await this.ctx.api.editMessageText(chatId, existingMsgId, chunk.text, { parse_mode: "HTML" });
        newMessageIds.push(existingMsgId);
      } else {
        const replyTo = i === 0 ? this.replyToMessageId : newMessageIds[i - 1];

        const msg = await this.ctx.api.sendMessage(chatId, chunk.text, {
          parse_mode: "HTML",
          message_thread_id: threadId,
          reply_parameters: replyTo ? { message_id: replyTo } : undefined,
        });

        newMessageIds.push(msg.message_id);
      }
    }

    for (const msgId of this.messageIds.skip(chunks.length)) await this.ctx.api.deleteMessage(chatId, msgId);

    this.messageIds = newMessageIds;
    this.lastSentText = html;
  }

  async deleteMessages(): Promise<void> {
    const chatId = this.chatId;
    for (const msgId of this.messageIds) await this.ctx.api.deleteMessage(chatId, msgId);
    this.messageIds = [];
  }
}
