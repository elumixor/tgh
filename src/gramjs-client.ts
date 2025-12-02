import { TelegramClient } from "telegram";
import { Logger } from "telegram/extensions/Logger";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { env } from "./env";
import { logger } from "./logger";

const GRAMJS_CONNECTION_RETRIES = 5;
const GRAMJS_MAX_MESSAGES_LIMIT = 100;
const GRAMJS_DEFAULT_MESSAGES_LIMIT = 10;

export class GramJSClient {
  private client: TelegramClient;
  private initialized = false;

  constructor() {
    const sessionString = env.TELEGRAM_SESSION_LOCAL ?? env.TELEGRAM_SESSION;
    const session = new StringSession(sessionString);
    this.client = new TelegramClient(session, env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
      connectionRetries: GRAMJS_CONNECTION_RETRIES,
      baseLogger: new (class extends Logger {
        override log() {
          return;
        }
      })(),
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

    const { query, limit = GRAMJS_DEFAULT_MESSAGES_LIMIT } = params;

    const messages = await this.client.getMessages(env.ALLOWED_CHAT_ID, {
      search: query,
      limit: Math.min(limit, GRAMJS_MAX_MESSAGES_LIMIT),
    });

    return messages.map((msg) => ({
      id: msg.id,
      text: msg.text || "",
      date: new Date(msg.date * 1000),
      senderId: msg.senderId?.valueOf() as number | undefined,
    }));
  }

  async getMessageMentions(messageId: number): Promise<{
    repliedTo?: number;
    replies: number[];
  }> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const [message, replies] = await Promise.all([
      this.client.getMessages(env.ALLOWED_CHAT_ID, { ids: [messageId] }),
      this.client.getMessages(env.ALLOWED_CHAT_ID, { replyTo: messageId, limit: GRAMJS_MAX_MESSAGES_LIMIT }),
    ]);

    return {
      repliedTo: message[0]?.replyTo?.replyToMsgId,
      replies: replies.map((msg) => msg.id),
    };
  }

  async getMessageHistory(params: {
    limit?: number;
    offset?: number;
  }): Promise<Array<{ id: number; text: string; date: Date; senderId?: number }>> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const { limit = GRAMJS_DEFAULT_MESSAGES_LIMIT, offset = 0 } = params;

    const messages = await this.client.getMessages(env.ALLOWED_CHAT_ID, {
      limit: Math.min(limit, GRAMJS_MAX_MESSAGES_LIMIT),
      offsetId: offset,
    });

    return messages.map((msg) => ({
      id: msg.id,
      text: msg.text || "",
      date: new Date(msg.date * 1000),
      senderId: msg.senderId?.valueOf() as number | undefined,
    }));
  }

  async getMessageInfo(messageId: number): Promise<{
    id: number;
    text: string;
    date: Date;
    senderId?: number;
    voice?: { fileId: string; duration: number; mimeType: string };
    photo?: { fileId: string };
    document?: { fileId: string; fileName?: string; mimeType?: string };
  }> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const messages = await this.client.getMessages(env.ALLOWED_CHAT_ID, { ids: [messageId] });
    const msg = messages[0];
    if (!msg) throw new Error(`Message ${messageId} not found`);

    const result: {
      id: number;
      text: string;
      date: Date;
      senderId?: number;
      voice?: { fileId: string; duration: number; mimeType: string };
      photo?: { fileId: string };
      document?: { fileId: string; fileName?: string; mimeType?: string };
    } = {
      id: msg.id,
      text: msg.text || "",
      date: new Date(msg.date * 1000),
      senderId: msg.senderId?.valueOf() as number | undefined,
    };

    if (msg.media instanceof Api.MessageMediaDocument && msg.media.document instanceof Api.Document) {
      const doc = msg.media.document;
      const isVoice = msg.media.voice === true;

      if (isVoice) {
        result.voice = {
          fileId: doc.id.toString(),
          duration:
            doc.attributes?.find((a): a is Api.DocumentAttributeAudio => a instanceof Api.DocumentAttributeAudio)
              ?.duration ?? 0,
          mimeType: doc.mimeType || "audio/ogg",
        };
      } else {
        result.document = {
          fileId: doc.id.toString(),
          fileName: doc.attributes?.find(
            (a): a is Api.DocumentAttributeFilename => a instanceof Api.DocumentAttributeFilename,
          )?.fileName,
          mimeType: doc.mimeType,
        };
      }
    }

    if (msg.media instanceof Api.MessageMediaPhoto && msg.media.photo instanceof Api.Photo) {
      result.photo = { fileId: msg.media.photo.id.toString() };
    }

    return result;
  }

  async getChatInfo(): Promise<{
    title: string;
    participantCount?: number;
    participants?: Array<{ id: number; username?: string; firstName?: string; lastName?: string }>;
    messageCount?: number;
    description?: string;
  }> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const entity = await this.client.getEntity(env.ALLOWED_CHAT_ID);

    const result: {
      title: string;
      participantCount?: number;
      participants?: Array<{ id: number; username?: string; firstName?: string; lastName?: string }>;
      messageCount?: number;
      description?: string;
    } = {
      title: "title" in entity ? (entity.title as string) : "Unknown",
    };

    if ("participantsCount" in entity) result.participantCount = entity.participantsCount as number;

    if ("about" in entity) result.description = entity.about as string;

    try {
      const messages = await this.client.getMessages(env.ALLOWED_CHAT_ID, { limit: 1 });
      if (messages.length > 0 && messages[0]) result.messageCount = messages[0].id;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to get message count");
    }

    try {
      const participants = await this.client.getParticipants(env.ALLOWED_CHAT_ID, { limit: GRAMJS_MAX_MESSAGES_LIMIT });
      result.participants = participants.map((p) => ({
        id: p.id.valueOf() as number,
        username: "username" in p ? (p.username as string) : undefined,
        firstName: "firstName" in p ? (p.firstName as string) : undefined,
        lastName: "lastName" in p ? (p.lastName as string) : undefined,
      }));
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to get participants");
    }

    return result;
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
