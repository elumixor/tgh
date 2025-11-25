import { Bot } from "grammy";
import { ClaudeAssistant } from "./claude-assistant";

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new Bot(botToken);
const assistant = new ClaudeAssistant();

bot.command("start", (ctx) => ctx.reply("Hello! I'm your AI assistant. Send me any message and I'll help you."));

bot.on("message:text", async (ctx) => {
  const userMessage = ctx.message.text;

  await ctx.replyWithChatAction("typing");

  try {
    const response = await assistant.processMessage(userMessage);
    await ctx.reply(response);
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply("Sorry, I encountered an error processing your request.");
  }
});

bot.start();
console.log("Bot started successfully!");
