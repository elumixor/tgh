import { logger } from "logger";
import { summarizer } from "services/summarizer";
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
    if (this.processing || this.queue.isEmpty) return;

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
      const userMessage = await summarizer.summarizeError(
        error instanceof Error ? error : new Error(JSON.stringify(error)),
      );

      logger.error({ jobId: job.id, error }, "Job failed");
      await job.telegramContext.api.sendMessage(job.chatId, userMessage, {
        reply_parameters: { message_id: job.messageId },
      });
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }
}
