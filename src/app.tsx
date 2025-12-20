import { JobProvider, Main } from "app-view";
import { env } from "env";
import { Bot } from "grammy";
import { ConsoleRenderer, GroupRenderer, TelegramRenderer } from "io/output";
import { Job } from "jobs/job";
import { JobQueue } from "jobs/job-queue";
import { logger } from "logger";
import { JobStore } from "services/job-store";
import { isBotMentioned } from "utils";

export class App {
  readonly bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  readonly jobStore = new JobStore("./cache/jobs", { maxJobs: 100 });
  private botUsername = "";
  private jobQueue = new JobQueue(this.processJob.bind(this));

  constructor() {
    this.bot.api.getMe().then((me) => {
      this.botUsername = me.username ?? "";
      logger.info({ username: me.username, userId: me.id }, "Bot initialized");
    });

    this.bot.on("message", (ctx) => {
      // Only allow messages from authorized user or allowed group that mentions the bot
      if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
        if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;
        if (!isBotMentioned(ctx.message, this.botUsername)) return;
      } else if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

      const messageId = ctx.message.message_id;
      const userMessage = ctx.message.text ?? ctx.message.caption;

      logger.info(
        {
          messageId,
          userMessage,
          replyToMessage: ctx.message.reply_to_message,
        },
        "Received message",
      );

      if (!userMessage) return;

      this.jobQueue.enqueue(new Job(ctx, userMessage, ctx.message.message_id, ctx.chat.id));
    });
  }

  private async processJob(job: Job): Promise<void> {
    // const telegramRenderer = new TelegramRenderer(job.telegramContext);
    // const consoleRenderer = new ConsoleRenderer();
    // const renderer = new GroupRenderer(telegramRenderer, consoleRenderer);

    const telegramRenderer = new TelegramRenderer(job.telegramContext);
    const renderer = new GroupRenderer(telegramRenderer);

    await renderer.render(
      <JobProvider job={job}>
        <Main />
      </JobProvider>,
    );
  }
}
