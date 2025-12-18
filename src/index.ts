import "@elumixor/extensions";

import { env } from "env";
import { webhookCallback } from "grammy";
import { logger } from "logger";
import { syncWithNotion } from "services/memory/memory-store";
import { gramjsClient } from "services/telegram";
import {
  handleApiJobDetail,
  handleApiJobList,
  handleJobDetail,
  handleJobList,
  parseJobIdFromPath,
  parseWsJobId,
  subscribeToJob,
  unsubscribeFromJob,
} from "web";
import { App } from "./app.tsx";

// Initialize GramJS client
try {
  await gramjsClient.connect();
} catch (error) {
  logger.error({ error: error instanceof Error ? error.message : error }, "Failed to initialize GramJS");
  process.exit(1);
}

// Sync memories with Notion (non-blocking background operation)
syncWithNotion();

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

// WebSocket data type
interface WsData {
  jobId: string;
}

// Setup webhook handler if in webhook mode
const handleWebhook =
  env.BOT_MODE === "webhook"
    ? webhookCallback(app.bot, "std/http", {
        timeoutMilliseconds: 60_000, // 60 seconds to accommodate long-running agent tasks
      })
    : null;

if (env.BOT_MODE === "webhook") {
  await app.bot.api.setWebhook(`${env.BASE_URL}/webhook`);
  logger.info({ webhookUrl: `${env.BASE_URL}/webhook` }, "Webhook configured");
} else {
  await app.bot.api.deleteWebhook();
  app.bot.start();
  logger.info("Bot started in polling mode");
}

// Start HTTP server for job inspector (both modes)
Bun.serve<WsData>({
  port: env.PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for job live updates
    const wsJobId = parseWsJobId(url.pathname);
    if (wsJobId && req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req, { data: { jobId: wsJobId } });
      if (success) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Telegram webhook (only in webhook mode)
    if (url.pathname === "/webhook" && handleWebhook) return await handleWebhook(req);

    // Job inspector routes
    if (url.pathname === "/jobs") return await handleJobList(app.jobStore);
    const htmlJobId = parseJobIdFromPath(url.pathname, "/jobs/");
    if (htmlJobId) return await handleJobDetail(app.jobStore, htmlJobId);

    // API routes
    if (url.pathname === "/api/jobs") return await handleApiJobList(app.jobStore);
    const apiJobId = parseJobIdFromPath(url.pathname, "/api/jobs/");
    if (apiJobId) return await handleApiJobDetail(app.jobStore, apiJobId);

    // Health check
    if (url.pathname === "/") return new Response("Bot is running!", { status: 200 });

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      const jobId = ws.data?.jobId;
      if (jobId) subscribeToJob(ws, jobId);
    },
    message() {
      // No client messages expected
    },
    close(ws) {
      unsubscribeFromJob(ws);
    },
  },
});

logger.info({ port: env.PORT, mode: env.BOT_MODE }, "Server started with job inspector");

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
