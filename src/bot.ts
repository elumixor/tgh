import { Bot } from "grammy";
import { ClaudeAssistant } from "./claude-assistant";
import { env } from "./env";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const assistant = new ClaudeAssistant();

bot.api.getMe().then((me) => {
  assistant.setBotUsername(me.username);
  console.log(`Bot username: @${me.username}`);
});

bot.on("message", async (ctx) => {
  const isGroupChat = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

  // Apply guard logic
  if (isGroupChat) {
    // In group chats: only respond in allowed chat when mentioned
    if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;

    const entities = [
      ...(ctx.message.entities || []),
      ...(ctx.message.caption_entities || []),
    ];
    const hasMention = entities.some((entity) => entity.type === "mention" || entity.type === "text_mention");

    if (!hasMention) return;

    console.log("Received mention in group from:", ctx.from?.username, "ID:", ctx.from?.id);
  } else {
    // In private chats: only respond to allowed user
    if (ctx.from?.id !== env.ALLOWED_USER_ID) return;
  }

  await ctx.replyWithChatAction("typing");

  try {
    // Build message content
    let userMessage = "";
    const imageUrls: string[] = [];

    // Get text content
    const text = ctx.message.text || ctx.message.caption || "";
    if (text) {
      userMessage = text;
    }

    // Extract from current message
    if (ctx.message.photo) {
      const photo = ctx.message.photo.at(-1);
      if (photo) {
        const fileLink = await ctx.api.getFile(photo.file_id);
        const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
        imageUrls.push(imageUrl);
      }
    }

    // Extract from replied-to message (for editing workflow)
    if (ctx.message.reply_to_message?.photo) {
      const photo = ctx.message.reply_to_message.photo.at(-1);
      if (photo) {
        const fileLink = await ctx.api.getFile(photo.file_id);
        const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
        imageUrls.push(imageUrl);
      }
    }

    // Format for Claude
    if (imageUrls.length > 0) {
      userMessage = userMessage
        ? `${userMessage}\n\nImage URLs: ${JSON.stringify(imageUrls)}`
        : `I've received ${imageUrls.length} image(s): ${JSON.stringify(imageUrls)}`;
    }

    // If no content, skip
    if (!userMessage) return;

    const response = await assistant.processMessage(userMessage, ctx);
    if (response) {
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
    }
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply("Sorry, I encountered an error processing your request.");
  }
});
