import { logger } from "logger";
import { summarizeError } from "services/summarizer";
import type { Job } from "./job";

export class JobQueue {
  private queue: Job[] = [];
  private processing = false;
  private jobCounter = 0;

  constructor(private readonly handler: (job: Job) => Promise<void>) {}

  enqueue(job: Job) {
    this.queue.push(job);
    const jobId = `job-${++this.jobCounter}`;
    logger.info({ jobId, queueLength: this.queue.length }, "Job enqueued");
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

    const jobId = `job-${this.jobCounter}`;
    logger.info({ jobId }, "Processing job");

    try {
      if (!this.handler) throw new Error("No job handler registered");
      await this.handler(job);
      logger.info({ jobId }, "Job completed");
    } catch (error) {
      const userMessage = await summarizeError(error instanceof Error ? error : new Error(JSON.stringify(error)));

      logger.error({ jobId, error }, "Job failed");
      await job.telegramContext.api.sendMessage(job.currentChatId, userMessage, {
        reply_parameters: { message_id: job.messageId },
        link_preview_options: { is_disabled: true },
      });
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }
}
