import { webhookCallback } from "grammy";
import { bot } from "./bot";
import { env } from "./env";

if (env.BOT_MODE === "webhook") {
  if (!env.WEBHOOK_URL) {
    throw new Error("WEBHOOK_URL is required for webhook mode");
  }

  await bot.api.setWebhook(`${env.WEBHOOK_URL}/webhook`);
  console.log(`Webhook set to: ${env.WEBHOOK_URL}/webhook`);

  const handleWebhook = webhookCallback(bot, "std/http");

  Bun.serve({
    port: env.PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/webhook") return await handleWebhook(req);
      if (url.pathname === "/") return new Response("Bot is running!", { status: 200 });
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Bot server started on port ${env.PORT}`);
} else {
  console.log("Polling mode: starting bot...");
  await bot.api.deleteWebhook();
  bot.start();
  console.log("Bot is running in polling mode");
}
