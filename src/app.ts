import { Bot } from "grammy";
import { claude } from "./claude-assistant";
import { env } from "./env";
import { logger } from "./logger";
import { isBotMentioned } from "./utils/mention-parser";

export class App {
  readonly bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  private botUsername?: string;
  private botUserId?: number;

  constructor() {
    this.bot.api.getMe().then((me) => {
      this.botUsername = me.username;
      this.botUserId = me.id;
      claude.botName = me.username;
      logger.info({ username: me.username, userId: me.id }, "Bot initialized");
    });

    this.bot.on("message", async (ctx) => {
      const isGroupChat = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

      if (isGroupChat) {
        if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;

        if (!isBotMentioned(ctx.message, this.botUsername, this.botUserId)) return;

        logger.info({ username: ctx.from?.username, userId: ctx.from?.id }, "Received mention in group");
      } else {
        if (ctx.from?.id !== env.ALLOWED_USER_ID) return;
      }

      await ctx.replyWithChatAction("typing");

      try {
        logger.info(
          {
            messageId: ctx.message.message_id,
            text: ctx.message.text || ctx.message.caption,
            hasPhoto: !!ctx.message.photo,
            replyToMessageId: ctx.message.reply_to_message?.message_id,
            replyToText: ctx.message.reply_to_message?.text || ctx.message.reply_to_message?.caption,
            replyToHasPhoto: !!ctx.message.reply_to_message?.photo,
          },
          "Processing incoming message",
        );

        let userMessage = "";
        const imageUrls: string[] = [];

        const text = ctx.message.text || ctx.message.caption || "";
        if (text) userMessage = text;

        if (ctx.message.photo) {
          const photo = ctx.message.photo.at(-1);
          if (photo) {
            const fileLink = await ctx.api.getFile(photo.file_id);
            const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
            imageUrls.push(imageUrl);
          }
        }

        if (ctx.message.reply_to_message) {
          const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;
          if (replyText) userMessage = `${userMessage}\n\nReplied-to message: "${replyText}"`;

          if (ctx.message.reply_to_message.photo) {
            const photo = ctx.message.reply_to_message.photo.at(-1);
            if (photo) {
              const fileLink = await ctx.api.getFile(photo.file_id);
              const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
              imageUrls.push(imageUrl);
            }
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
          await ctx.reply(response, replyOptions);
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "Error processing message");
        await ctx.reply("Sorry, I encountered an error processing your request.");
      }
    });
  }
}
