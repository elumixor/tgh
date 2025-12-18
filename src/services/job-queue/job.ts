import { env } from "env";
import type { Context } from "grammy";

export class Job {
  readonly id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  readonly link = `${env.BASE_URL}/jobs/${this.id}`;

  constructor(
    readonly telegramContext: Context,
    readonly userMessage: string,
    readonly messageId: number,
    readonly chatId: number,
  ) {}
}
