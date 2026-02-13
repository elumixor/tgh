import "@elumixor/extensions";

import { JobProvider, Main } from "app-view";
import { db } from "db";
import { env } from "env";
import { Bot, webhookCallback } from "grammy";
import { TelegramRenderer } from "io/output";
import { Job, JobQueue } from "jobs";
import { Listr } from "listr2";
import { logger } from "logger";
import { memories } from "services/memories";
import { skills } from "services/skills";
import { systemPrompt } from "services/system-prompt";
import { gramjsClient } from "services/telegram";
import { transcribeAudio } from "services/transcription";
import { notionMcpServer } from "tools/notion";
import { isBotMentioned } from "utils";

const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const { id: botChatId, username: botUsername = "", first_name: botName } = await bot.api.getMe();

await new Listr(
  [
    {
      title: "Initialize database",
      task: async (_, task) => {
        const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
        migrate(db, { migrationsFolder: "./drizzle" });
        task.title = "Database initialized";
      },
    },
    { title: "Initialize Google APIs", task: () => import("services/google-api") },
    {
      title: "Connect to Telegram",
      task: (_, task) =>
        task.newListr(
          [
            {
              title: "Connect GramJS",
              task: async (_, sub) => {
                sub.title = await gramjsClient.connect();
              },
            },
            {
              title: "Pre-fetch chat info",
              task: async (_, sub) => {
                sub.title = await gramjsClient.prefetchDefaultChat();
              },
            },
          ],
          { concurrent: false },
        ),
    },
    {
      title: "Sync memories",
      task: async (_, task) => {
        task.title = await memories.sync();
      },
    },
    {
      title: "Sync skills",
      task: async (_, task) => {
        task.title = await skills.sync();
      },
    },
    {
      title: "Sync system prompt",
      task: async (_, task) => {
        task.title = await systemPrompt.sync();
      },
    },
    {
      title: "Start Notion MCP server",
      task: () => notionMcpServer.connect(),
    },
  ],
  { concurrent: true, exitOnError: false },
).run();

// Notify about new version in production (send to private chat)
if (env.TELEGRAM_SESSION_LOCAL === undefined) {
  try {
    const packageJson = await Bun.file("./package.json").json();
    const version = packageJson.config?.version as string;
    await bot.api.sendMessage(env.ALLOWED_USER_ID, `Bot updated to version ${version}`);
    logger.info({ version }, "Version notification sent");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to send version notification",
    );
  }
}

// Set up job queue with Telegram rendering
const jobQueue = new JobQueue((job: Job) =>
  new TelegramRenderer(job.telegramContext).render(
    <JobProvider job={job}>
      <Main />
    </JobProvider>,
  ),
);

// Main message handler
bot.on("message", async (ctx) => {
  // Only allow messages from authorized user or allowed group that mentions the bot
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (ctx.chat?.id !== env.GROUP_CHAT_ID) return;
    if (!isBotMentioned(ctx.message, botUsername)) return;
  } else if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

  // Immediately react with 👀 to acknowledge the message
  await ctx.react("👀").catch((error) => {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Failed to set initial reaction");
  });

  let userMessage = ctx.message.text ?? ctx.message.caption;

  if (!userMessage && ctx.message.voice) {
    const file = await ctx.api.getFile(ctx.message.voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    userMessage = await transcribeAudio(buffer, ctx.message.voice.file_unique_id);
  }

  if (!userMessage && (ctx.message.photo || ctx.message.document)) userMessage = "(attachment)";

  logger.info({ userMessage }, "Received message");

  if (!userMessage) return;

  const chatType = ctx.chat.type === "private" ? "private" : "group";
  const chatName =
    ctx.chat.type === "private"
      ? `${ctx.chat.first_name ?? ""} ${ctx.chat.last_name ?? ""}`.trim()
      : "title" in ctx.chat
        ? ctx.chat.title
        : "Unknown";

  jobQueue.enqueue(new Job(ctx, ctx.message.message_id, chatType, chatName, botChatId, botUsername, botName));
});

// Setup webhook handler if in webhook mode
const handleWebhook = env.BOT_MODE === "webhook" ? webhookCallback(bot, "std/http") : null;

if (env.BOT_MODE === "webhook") {
  await bot.api.setWebhook(`${env.BASE_URL}/webhook`);
  logger.info({ webhookUrl: `${env.BASE_URL}/webhook` }, "Webhook configured");
} else {
  await bot.api.deleteWebhook();
  bot.start();
  logger.info("Bot started in polling mode");
}

// Start HTTP server for webhook (only in webhook mode)
if (env.BOT_MODE === "webhook") {
  Bun.serve({
    port: env.PORT,
    async fetch(req) {
      const url = new URL(req.url);

      // Telegram webhook
      if (url.pathname === "/webhook" && handleWebhook) return await handleWebhook(req);

      // Health check
      if (url.pathname === "/") return new Response("Bot is running!", { status: 200 });

      return new Response("Not Found", { status: 404 });
    },
  });

  logger.info({ port: env.PORT }, "Server started in webhook mode");
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down...");
  try {
    await notionMcpServer.close();
    await gramjsClient.disconnect();
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Error during shutdown");
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
