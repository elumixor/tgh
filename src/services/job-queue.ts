import type { Context } from "grammy";
import { logger } from "logger";
import { formatError } from "utils";

export interface Job {
  id: string;
  ctx: Context;
  userMessage: string;
  messageId: number;
  statusMessageId: number;
  chatId: number;
  threadId?: number;
}

type JobHandler = (job: Job) => Promise<void>;

export class JobQueue {
  private queue: Job[] = [];
  private processing = false;
  private handler?: JobHandler;

  setHandler(handler: JobHandler) {
    this.handler = handler;
  }

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
      try {
        await job.ctx.api.sendMessage(job.chatId, "Sorry, I encountered an error processing your request.", {
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

  getQueueLength() {
    return this.queue.length;
  }

  isProcessing() {
    return this.processing;
  }
}
