import { gramjsClient } from "services/telegram";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getMessagesTool = defineTool(
  "GetMessages",
  "Get messages from a chat with flexible filtering. Can search by words to be found in a message, get messages before a certain message ID or date, filter by date range, and filter by topic name (for forum chats). Returns XML-formatted messages: oldest first, newest last.",
  z.object({
    words: z
      .string()
      .nullable()
      .describe(
        "Optional search query as space-separated words. Finds messages containing ALL words. Partial matches work (e.g., 'most' finds 'mostly'). No regex or special syntax.",
      ),
    beforeMessageId: z
      .number()
      .nullable()
      .describe("Get messages older than this message ID. If not provided, returns the most recent messages."),
    limit: z.number().min(1).max(50).default(10).describe("Number of messages to retrieve. Maximum is 50."),
    chatType: z.enum(["private", "group"]).default("group").describe("Which chat to get messages from"),
    beforeDate: z.iso
      .datetime()
      .nullable()
      .describe("Get messages before this date (ISO 8601 format). If not provided, no upper date limit is applied."),
    afterDate: z.iso
      .datetime()
      .nullable()
      .describe("Get messages after this date (ISO 8601 format). If not provided, no lower date limit is applied."),
    topicName: z
      .string()
      .nullable()
      .describe(
        "Optional topic name to filter messages from (for forum chats only). Only returns messages from the specified topic.",
      ),
  }),
  async (
    { words: query, limit, beforeMessageId, chatType, beforeDate, afterDate, topicName },
    { currentChatId, botChatId, groupChatId },
  ) => {
    const isCurrentChatGroup = currentChatId === groupChatId;
    if (isCurrentChatGroup && chatType === "private")
      return "Error: Cannot read from the private chat when prompted from the group chat.";

    const targetChatId = chatType === "private" ? botChatId : groupChatId;
    let messages = await gramjsClient.getMessages({
      query: query ?? undefined,
      chatId: targetChatId,
      limit,
      offset: beforeMessageId ?? undefined,
      order: "oldest first",
      beforeDate: beforeDate ? new Date(beforeDate) : undefined,
      afterDate: afterDate ? new Date(afterDate) : undefined,
    });

    // Filter by topic name if specified
    if (topicName) messages = messages.filter((msg) => msg.topicName === topicName);

    return messages.map((msg) => msg.toXml()).join("\n");
  },
);
