import { Bot } from "grammy";
import type { Document, PhotoSize } from "grammy/types";
import { claude } from "./claude-assistant";
import { env } from "./env";
import { logger } from "./logger";
import { replyWithLongMessage } from "./telegram-message-sender";
import { isImageDocument } from "./utils/image-detector";
import { isBotMentioned } from "./utils/mention-parser";

const formatError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function getPhotoUrl(fileId: string, bot: Bot): Promise<string> {
  const fileLink = await bot.api.getFile(fileId);
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
}

export class App {
  readonly bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  private botUsername = "";
  private botUserId = 0;

  constructor() {
    this.initializeBot();
    this.setupMessageHandler();
  }

  private initializeBot(): void {
    this.bot.api.getMe().then((me) => {
      this.botUsername = me.username ?? "";
      this.botUserId = me.id;
      claude.botName = me.username;
      logger.info({ username: me.username, userId: me.id }, "Bot initialized");
    });
  }

  private setupMessageHandler(): void {
    this.bot.on("message", async (ctx) => {
      const isGroupChat = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

      if (isGroupChat) {
        if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;
        if (!isBotMentioned(ctx.message, this.botUsername, this.botUserId)) return;
        logger.info({ username: ctx.from?.username, userId: ctx.from?.id }, "Received mention in group");
      } else if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

      await ctx.replyWithChatAction("typing");

      try {
        logger.info(
          {
            messageId: ctx.message.message_id,
            text: ctx.message.text || ctx.message.caption,
            hasImage: !!ctx.message.photo || (!!ctx.message.document && isImageDocument(ctx.message.document)),
            replyToMessageId: ctx.message.reply_to_message?.message_id,
            replyToText: ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption,
            replyToHasImage:
              !!ctx.message.reply_to_message?.photo ||
              (!!ctx.message.reply_to_message?.document && isImageDocument(ctx.message.reply_to_message.document)),
          },
          "Processing incoming message",
        );

        let userMessage = ctx.message.text || ctx.message.caption || "";
        const imageUrls: string[] = [];

        if (ctx.message.photo) {
          const url = await this.extractPhotoUrl(ctx.message.photo, this.bot);
          if (url) imageUrls.push(url);
        } else if (ctx.message.document && isImageDocument(ctx.message.document)) {
          const url = await this.extractDocumentUrl(ctx.message.document, this.bot);
          if (url) imageUrls.push(url);
        }

        if (ctx.message.reply_to_message) {
          const replyId = ctx.message.reply_to_message.message_id;
          const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

          userMessage = `${userMessage}\n\nContext: Replying to message ${replyId}`;
          if (replyText) userMessage += `: "${replyText}"`;

          if (ctx.message.reply_to_message.photo) {
            const url = await this.extractPhotoUrl(ctx.message.reply_to_message.photo, this.bot);
            if (url) imageUrls.push(url);
          } else if (ctx.message.reply_to_message.document && isImageDocument(ctx.message.reply_to_message.document)) {
            const url = await this.extractDocumentUrl(ctx.message.reply_to_message.document, this.bot);
            if (url) imageUrls.push(url);
          }
        }

        if (imageUrls.length > 0) {
          userMessage = userMessage
            ? `${userMessage}\n\nImage URLs: ${JSON.stringify(imageUrls)}`
            : `I've received ${imageUrls.length} image(s): ${JSON.stringify(imageUrls)}`;
        }

        if (!userMessage) return;

        const response = await claude.processMessage(userMessage, ctx);
        if (response) {
          const replyOptions: { reply_parameters: { message_id: number }; message_thread_id?: number } = {
            reply_parameters: { message_id: ctx.message.message_id },
          };
          if (ctx.message.message_thread_id) replyOptions.message_thread_id = ctx.message.message_thread_id;
          await replyWithLongMessage(ctx, response, replyOptions);
        }
      } catch (error) {
        logger.error({ error: formatError(error) }, "Error processing message");
        await ctx.reply("Sorry, I encountered an error processing your request.");
      }
    });
  }

  private async extractPhotoUrl(photos: PhotoSize[], bot: Bot): Promise<string | undefined> {
    const photo = photos.at(-1);
    if (!photo) return undefined;
    return getPhotoUrl(photo.file_id, bot);
  }

  private async extractDocumentUrl(document: Document, bot: Bot): Promise<string | undefined> {
    return getPhotoUrl(document.file_id, bot);
  }
}
