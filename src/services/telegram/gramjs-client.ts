import { env } from "env";
import { logger } from "logger";
import ora from "ora";
import { TelegramClient } from "telegram";
import { Logger } from "telegram/extensions/Logger";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { ChatMessage, type MessageOrder } from "./chat-message";

const GRAMJS_CONNECTION_RETRIES = 5;
const GRAMJS_MAX_MESSAGES_LIMIT = 100;
const GRAMJS_DEFAULT_MESSAGES_LIMIT = 10;

export class GramJSClient {
  private client: TelegramClient;
  private initialized = false;
  private chatInfoCache = new Map<number, { title?: string; isForum: boolean }>();
  private topicsCache = new Map<number, Map<number, string>>();

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
      await this.client.getMe();

      // Pre-fetch chat info for default chat
      await this.prefetchChatInfo(env.GROUP_CHAT_ID);

      this.initialized = true;
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Failed to connect GramJS client");
      throw new Error("GramJS session invalid or expired. Run 'bun run login' to regenerate.");
    }
  }

  async getMessages({
    query,
    chatId = env.GROUP_CHAT_ID,
    limit = GRAMJS_DEFAULT_MESSAGES_LIMIT,
    offset,
    order = "newest first",
    beforeDate,
    afterDate,
  }: {
    query?: string;
    chatId?: number;
    limit?: number;
    offset?: number;
    order?: MessageOrder;
    beforeDate?: Date;
    afterDate?: Date;
  }): Promise<ChatMessage[]> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    // Get chat info from cache or fetch if not cached
    let chatInfo = this.chatInfoCache.get(chatId);
    let topicsMap = this.topicsCache.get(chatId);

    if (!chatInfo) {
      // Not in cache, fetch in parallel
      const [chat, topics] = await Promise.all([this.client.getEntity(chatId), this.fetchForumTopics(chatId)]);

      const chatTitle = "title" in chat ? (chat.title as string) : undefined;
      const isForum = "forum" in chat && (chat.forum as boolean);
      chatInfo = { title: chatTitle, isForum };
      this.chatInfoCache.set(chatId, chatInfo);

      if (topics) {
        topicsMap = topics;
        this.topicsCache.set(chatId, topics);
      }
    }

    const apiMessages = await this.client.getMessages(chatId, {
      search: query,
      limit: Math.min(limit, GRAMJS_MAX_MESSAGES_LIMIT),
      offsetId: offset,
    });

    let messages = apiMessages.map((msg) => ChatMessage.fromApiMessage(msg, chatInfo.title, topicsMap));

    // Apply date filtering
    const beforeTimestamp = beforeDate ? beforeDate.getTime() / 1000 : null;
    const afterTimestamp = afterDate ? afterDate.getTime() / 1000 : null;

    if (beforeTimestamp || afterTimestamp) {
      messages = messages.filter((msg) => {
        const msgTimestamp = msg.date instanceof Date ? msg.date.getTime() / 1000 : msg.date;
        if (beforeTimestamp && msgTimestamp >= beforeTimestamp) return false;
        if (afterTimestamp && msgTimestamp <= afterTimestamp) return false;
        return true;
      });
    }

    return order === "oldest first" ? messages.reverse() : messages;
  }

  async getChatInfo(chatId: number = env.GROUP_CHAT_ID): Promise<{
    title: string;
    participantCount: number;
    participants: { id: number; username?: string; firstName?: string; lastName?: string }[];
    messageCount: number;
    lastMessage: { id: number; date: Date };
    firstMessage: { id: number; date: Date };
    topics: { id: string; name: string }[];
  }> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    const entity = await this.client.getEntity(chatId);
    const title = "title" in entity ? (entity.title as string) : "Unknown";

    // Get last message
    const lastMessages = await this.client.getMessages(chatId, { limit: 1 });
    const lastMessage = lastMessages[0];
    if (!lastMessage) throw new Error("No messages found in chat");

    const messageCount = lastMessage.id;

    // Get first message (use minId = 0 and reverse to get oldest)
    const firstMessages = await this.client.getMessages(chatId, { limit: 1, minId: 0 });
    const firstMessage = firstMessages[0];
    if (!firstMessage) throw new Error("Failed to get first message");

    // Get participants
    const participantsList = await this.client.getParticipants(chatId, { limit: GRAMJS_MAX_MESSAGES_LIMIT });
    const participants = participantsList.map((p) => ({
      id: p.id.valueOf() as number,
      username: "username" in p ? (p.username as string) : undefined,
      firstName: "firstName" in p ? (p.firstName as string) : undefined,
      lastName: "lastName" in p ? (p.lastName as string) : undefined,
    }));

    const participantCount = "participantsCount" in entity ? (entity.participantsCount as number) : participants.length;

    // Get topics (for forum/supergroup chats)
    const topics: { id: string; name: string }[] = [];
    try {
      if ("forum" in entity && entity.forum) {
        const result = await this.client.invoke(
          new Api.channels.GetForumTopics({
            channel: chatId,
            limit: 100,
          }),
        );
        if ("topics" in result) {
          for (const topic of result.topics as { id: number; title?: string }[]) {
            if (topic.title) topics.push({ id: String(topic.id), name: topic.title });
          }
        }
      }
    } catch (error) {
      logger.debug(
        { error: error instanceof Error ? error.message : error },
        "Failed to get topics (chat may not be a forum)",
      );
    }

    return {
      title,
      participantCount,
      participants,
      messageCount,
      lastMessage: { id: lastMessage.id, date: new Date(lastMessage.date * 1000) },
      firstMessage: { id: firstMessage.id, date: new Date(firstMessage.date * 1000) },
      topics,
    };
  }

  async addUserToGroup(chatId: number, username: string): Promise<{ success: boolean; error?: string }> {
    if (!this.initialized) throw new Error("GramJS client not initialized");

    try {
      // Resolve username to user entity
      const user = await this.client.getEntity(username);

      // Get the chat entity
      const chat = await this.client.getEntity(chatId);

      // Add user to the channel/supergroup
      await this.client.invoke(
        new Api.channels.InviteToChannel({
          channel: chat,
          users: [user],
        }),
      );

      logger.info({ username, chatId }, "User added to group successfully");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ username, chatId, error: errorMessage }, "Failed to add user to group");
      return { success: false, error: errorMessage };
    }
  }

  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.client.disconnect();
      this.initialized = false;
      logger.info("GramJS client disconnected");
    }
  }

  private async prefetchChatInfo(chatId: number): Promise<void> {
    const spinner = ora("Fetching chat info...").start();
    try {
      const [chat, topics] = await Promise.all([this.client.getEntity(chatId), this.fetchForumTopics(chatId)]);

      const chatTitle = "title" in chat ? (chat.title as string) : undefined;
      const isForum = "forum" in chat && (chat.forum as boolean);
      this.chatInfoCache.set(chatId, { title: chatTitle, isForum });

      if (topics) this.topicsCache.set(chatId, topics);

      spinner.succeed(`Chat info pre-fetched: ${chatTitle}${isForum ? " (forum)" : ""}, ${topics?.size ?? 0} topics`);
    } catch (error) {
      spinner.fail("Failed to pre-fetch chat info");
      logger.warn({ error: error instanceof Error ? error.message : error, chatId }, "Failed to pre-fetch chat info");
    }
  }

  private async fetchForumTopics(chatId: number): Promise<Map<number, string> | undefined> {
    try {
      const chat = await this.client.getEntity(chatId);
      if (!("forum" in chat) || !chat.forum) return undefined;

      const result = await this.client.invoke(
        new Api.channels.GetForumTopics({
          channel: chatId,
          limit: 100,
        }),
      );

      if ("topics" in result && Array.isArray(result.topics)) {
        const topicsMap = new Map<number, string>();
        for (const topic of result.topics as { id: number; title?: string }[]) {
          if (topic.title) topicsMap.set(topic.id, topic.title);
        }
        return topicsMap;
      }
    } catch (error) {
      logger.debug({ error: error instanceof Error ? error.message : error }, "Failed to fetch forum topics");
    }
    return undefined;
  }
}

export const gramjsClient = new GramJSClient();
