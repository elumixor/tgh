import { env } from "env";
import type { Context } from "grammy";

export class Job {
  constructor(
    readonly id: string,
    readonly telegramContext: Context,
    readonly userMessage: string,
    readonly messageId: number,
    readonly chatId: number,
  ) {}

  get link() {
    // Create job link URL for web inspector
    const baseUrl = env.BOT_MODE === "webhook" ? env.WEBHOOK_URL : `http://localhost:${env.PORT}`;
    const jobLink = baseUrl ? `${baseUrl}/jobs/${this.id}` : undefined;
    return jobLink;
  }
}
