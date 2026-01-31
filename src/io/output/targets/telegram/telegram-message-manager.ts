import type { Context } from "grammy";
import type { LinkPreviewOptions as TelegramLinkPreviewOptions } from "grammy/types";
import type { ElementNode, LinkPreviewOptions } from "io/output/core";
import { splitMessage } from "services/telegram";
import { serializeTelegram } from "./telegram-serializer";

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

function getLinkPreviewOptions(text: string, options?: LinkPreviewOptions): TelegramLinkPreviewOptions {
  if (!options) return { is_disabled: true };

  const { ignored, previewUrl } = options;

  if (previewUrl && !ignored.has(previewUrl)) return { url: previewUrl };

  const urls = extractUrls(text);
  const firstNonIgnored = urls.find((url) => !ignored.has(url));

  if (firstNonIgnored) return { url: firstNonIgnored };

  return { is_disabled: true };
}

export class TelegramMessageManager {
  private messageIds: number[] = [];
  private lastSentText?: string;
  private lastSentChunks: string[] = [];

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
    const linkPreview = node.props.linkPreview as LinkPreviewOptions | undefined;

    const chunks = splitMessage(html);
    const newMessageIds: number[] = [];
    const newChunks: string[] = [];

    for (const [i, chunk] of chunks.entries()) {
      if (!chunk) continue;

      const linkPreviewOptions = getLinkPreviewOptions(chunk.text, linkPreview);
      const existingMsgId = this.messageIds[i];

      if (existingMsgId !== undefined) {
        if (chunk.text !== this.lastSentChunks[i]) {
          await this.ctx.api.editMessageText(chatId, existingMsgId, chunk.text, {
            parse_mode: "HTML",
            link_preview_options: linkPreviewOptions,
          });
        }
        newMessageIds.push(existingMsgId);
      } else {
        const replyTo = i === 0 ? this.replyToMessageId : newMessageIds[i - 1];

        const msg = await this.ctx.api.sendMessage(chatId, chunk.text, {
          parse_mode: "HTML",
          message_thread_id: threadId,
          reply_parameters: replyTo ? { message_id: replyTo } : undefined,
          link_preview_options: linkPreviewOptions,
        });

        newMessageIds.push(msg.message_id);
      }

      newChunks.push(chunk.text);
    }

    for (const msgId of this.messageIds.skip(chunks.length)) await this.ctx.api.deleteMessage(chatId, msgId);

    this.messageIds = newMessageIds;
    this.lastSentChunks = newChunks;
    this.lastSentText = html;
  }

  async deleteMessages(): Promise<void> {
    const chatId = this.chatId;
    for (const msgId of this.messageIds) await this.ctx.api.deleteMessage(chatId, msgId);
    this.messageIds = [];
    this.lastSentChunks = [];
  }
}
