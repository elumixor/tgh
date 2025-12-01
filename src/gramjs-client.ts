import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { env } from "./env";
import { logger } from "./logger";

export class GramJSClient {
  private client: TelegramClient;
  private initialized = false;

  constructor() {
    const session = new StringSession(env.TELEGRAM_SESSION);
    this.client = new TelegramClient(session, env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
      connectionRetries: 5,
    });
  }

  async connect(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.client.connect();
      const me = await this.client.getMe();
      logger.info({ userId: me.id, username: me.username }, "GramJS client connected");
      this.initialized = true;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Failed to connect GramJS client");
      throw new Error("GramJS session invalid or expired. Run 'bun run login' to regenerate.");
    }
  }

  async searchMessages(params: {
    query: string;
    limit?: number;
  }): Promise<Array<{ id: number; text: string; date: Date; senderId?: number }>> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const { query, limit = 10 } = params;

    const messages = await this.client.getMessages(env.ALLOWED_CHAT_ID, {
      search: query,
      limit: Math.min(limit, 100),
    });

    return messages.map((msg) => ({
      id: msg.id,
      text: msg.text || "",
      date: new Date(msg.date * 1000),
      senderId: msg.senderId?.valueOf() as number | undefined,
    }));
  }

  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.client.disconnect();
      this.initialized = false;
      logger.info("GramJS client disconnected");
    }
  }
}

export const gramjsClient = new GramJSClient();
