import { Bot } from "grammy";
import { ClaudeAssistant } from "./claude-assistant";
import { env } from "./env";

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const assistant = new ClaudeAssistant();

bot.api.getMe().then((me) => {
  assistant.setBotUsername(me.username);
  console.log(`Bot username: @${me.username}`);
});

bot.on("message::mention", async (ctx) => {
  if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;

  console.log("Received mention in group from:", ctx.from?.username, "ID:", ctx.from?.id);

  const userMessage = ctx.message.text;
  if (!userMessage) return;

  await ctx.replyWithChatAction("typing");

  try {
    const response = await assistant.processMessage(userMessage);
    await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply("Sorry, I encountered an error processing your request.");
  }
});

bot.on("message:text", async (ctx) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") return;
  if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

  const userMessage = ctx.message.text;
  await ctx.replyWithChatAction("typing");

  try {
    const response = await assistant.processMessage(userMessage);
    await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply("Sorry, I encountered an error processing your request.");
  }
});
