import { MasterAgent } from "agents/master-agent/master-agent";
import { env } from "env";
import { Bot } from "grammy";
import { JobStoreOutput, OutputGroup, TelegramOutput } from "io";
import { logger } from "logger";
import { Job } from "services/job-queue/job";
import { JobQueue } from "services/job-queue/job-queue";
import { JobStore } from "services/job-store";
import { formatError, isBotMentioned } from "utils";
import { notifyJobSubscribers } from "web";

export class App {
  readonly bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  readonly jobStore = new JobStore("./cache/jobs", { maxJobs: 100 });
  private botUsername = "";
  private masterAgent = new MasterAgent();
  private jobQueue = new JobQueue(this.processJob.bind(this));

  constructor() {
    this.bot.api.getMe().then((me) => {
      this.botUsername = me.username ?? "";
      logger.info({ username: me.username, userId: me.id }, "Bot initialized");
    });

    this.bot.on("message", async (ctx) => {
      // Only alow messages from authorized user or allowed group that mentions the bot
      if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
        if (ctx.chat?.id !== env.ALLOWED_CHAT_ID) return;
        if (!isBotMentioned(ctx.message, this.botUsername)) return;
      } else if (ctx.from?.id !== env.ALLOWED_USER_ID) return;

      try {
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

        // Queue the job and return immediately
        this.jobQueue.enqueue(
          new Job(this.jobStore.generateId(), ctx, userMessage, ctx.message.message_id, ctx.chat.id),
        );
      } catch (error) {
        logger.error({ error: formatError(error) }, "Error queueing message");
        await ctx.reply("Sorry, I encountered an error queueing your request.");
      }
    });
  }

  private async processJob(job: Job) {
    const jobStoreOutput = new JobStoreOutput(this.jobStore, job.id, job.userMessage, notifyJobSubscribers);
    const telegramOutput = new TelegramOutput(job.telegramContext, 500);
    const output = new OutputGroup([telegramOutput, jobStoreOutput]);

    try {
      const statusMessage = output.sendMessage({
        text: `[Processing...](${job.link})`,
        replyToMessageId: job.messageId,
      });

      const result = await this.masterAgent.processTask(job.userMessage, {
        telegramCtx: job.telegramContext,
        messageId: job.messageId,
        statusMessage,
      });

      if (!result.success) throw new Error(result.error ?? "Master agent task failed");

      logger.info({ jobId: job.id, storeJobId: job.id }, "Master agent completed");

      // Mark job as completed
      jobStoreOutput.complete();

      // Append final result to status message (keeping the status visible)
      if (result.result) statusMessage.append(`\n---\n${result.result}`);
    } catch (error) {
      // Mark job as failed in store (for web UI)
      jobStoreOutput.error();
      throw error; // Let job queue handle error logging and user notification
    }
  }
}
