import { env } from "env";
import { webhookCallback } from "grammy";
import { logger } from "logger";
import { gramjsClient } from "services/telegram";
import { App } from "./app";

// Initialize GramJS client
try {
  await gramjsClient.connect();
} catch (error) {
  logger.error({ error: error instanceof Error ? error.message : error }, "Failed to initialize GramJS");
  process.exit(1);
}

const app = new App();

// Notify about new version in production
if (env.TELEGRAM_SESSION_LOCAL === undefined) {
  try {
    const versionFile = await Bun.file("./version.json").json();
    const version = versionFile.version as string;
    await app.bot.api.sendMessage(env.ALLOWED_CHAT_ID, `🚀 Bot updated to version ${version}`);
    logger.info({ version }, "Version notification sent");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to send version notification",
    );
  }
}

if (env.BOT_MODE === "webhook") {
  await app.bot.api.setWebhook(`${env.WEBHOOK_URL}/webhook`);
  logger.info({ webhookUrl: `${env.WEBHOOK_URL}/webhook` }, "Webhook configured");

  const handleWebhook = webhookCallback(app.bot, "std/http", {
    timeoutMilliseconds: 60_000, // 60 seconds to accommodate long-running agent tasks
  });

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
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down...");
  try {
    await gramjsClient.disconnect();
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Error during shutdown");
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
