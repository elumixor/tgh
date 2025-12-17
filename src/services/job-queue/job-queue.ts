import { logger } from "logger";
import { formatError } from "utils";
import { summarizer } from "../summarizer";
import type { Job } from "./job";

export class JobQueue {
  private queue: Job[] = [];
  private processing = false;

  constructor(private readonly handler: (job: Job) => Promise<void>) {}

  enqueue(job: Job) {
    this.queue.push(job);
    logger.info({ jobId: job.id, queueLength: this.queue.length }, "Job enqueued");
    void this.processNext();
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const job = this.queue.shift();

    if (!job) {
      this.processing = false;
      return;
    }

    logger.info({ jobId: job.id }, "Processing job");

    try {
      if (!this.handler) throw new Error("No job handler registered");
      await this.handler(job);
      logger.info({ jobId: job.id }, "Job completed");
    } catch (error) {
      logger.error({ jobId: job.id, error: formatError(error) }, "Job failed");

      const userMessage =
        error instanceof Error
          ? await summarizer.summarizeError(error)
          : "An unexpected error occurred. Please try again.";

      try {
        await job.telegramContext.api.sendMessage(job.chatId, userMessage, {
          reply_parameters: { message_id: job.messageId },
        });
      } catch (sendError) {
        logger.error({ jobId: job.id, error: formatError(sendError) }, "Failed to send error message");
      }
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }
}
