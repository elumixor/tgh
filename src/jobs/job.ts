import { random } from "@elumixor/frontils";
import { env } from "env";
import type { Context } from "grammy";

export type ChatType = "private" | "group";
export type JobState = "running" | "summarizing" | "done";

export class Job {
  readonly id = random.string(32).toLowerCase();

  /** GramJS chat ID for group chat */
  readonly groupChatId: number = env.GROUP_CHAT_ID;
  state: JobState = "running";

  constructor(
    readonly telegramContext: Context,
    readonly messageId: number,
    readonly chatType: ChatType,
    readonly chatName: string,
    /** GramJS chat ID for private chat (bot's ID) */
    readonly botChatId: number,
    readonly botUsername: string,
    readonly botName: string,
  ) {}

  /** Returns the appropriate chat ID for GramJS based on chatType */
  get currentChatId() {
    return this.chatType === "private" ? this.botChatId : this.groupChatId;
  }
}
