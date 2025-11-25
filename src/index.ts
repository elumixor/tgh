import { Bot, type Update } from "grammy";
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

// Webhook setup
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://tgh-bot.onrender.com`;

// Set webhook
await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`);
console.log(`Webhook set to: ${WEBHOOK_URL}/webhook`);

// Start server with webhook handler
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/webhook" && req.method === "POST") {
      try {
        const update = await req.json() as Update;
        await bot.handleUpdate(update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }

    if (url.pathname === "/") {
      return new Response("Bot is running!", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Bot server started on port ${PORT}`);
