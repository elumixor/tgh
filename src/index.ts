import { webhookCallback } from "grammy";
import { App } from "./app";
import { env } from "./env";
import { gramjsClient } from "./gramjs-client";
import { logger } from "./logger";

// Initialize GramJS client
try {
  await gramjsClient.connect();
} catch (error) {
  logger.error({ error: error instanceof Error ? error.message : error }, "Failed to initialize GramJS");
  process.exit(1);
}

const app = new App();

if (env.BOT_MODE === "webhook") {
  if (!env.WEBHOOK_URL) throw new Error("WEBHOOK_URL is required for webhook mode");

  await app.bot.api.setWebhook(`${env.WEBHOOK_URL}/webhook`);
  logger.info({ webhookUrl: `${env.WEBHOOK_URL}/webhook` }, "Webhook configured");

  const handleWebhook = webhookCallback(app.bot, "std/http");

  Bun.serve({
    port: env.PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/webhook") return await handleWebhook(req);
      if (url.pathname === "/") return new Response("Bot is running!", { status: 200 });
      return new Response("Not Found", { status: 404 });
    },
  });

  logger.info({ port: env.PORT }, "Bot server started");
} else {
  logger.info("Polling mode: starting bot...");
  await app.bot.api.deleteWebhook();
  app.bot.start();
  logger.info("Bot is running in polling mode");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await gramjsClient.disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  await gramjsClient.disconnect();
  process.exit(0);
});
