import type { Tool } from "agents/agent";
import { logger } from "logger";
import { gramjsClient } from "services/telegram";

export const getChatHistoryTool: Tool = {
  definition: {
    name: "get_chat_history",
    description:
      "Get recent chat history from the current Telegram chat. Returns messages in reverse chronological order (newest first). Use when user asks to see recent messages or conversation history.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of messages to retrieve (default: 10, max: 100)",
          minimum: 1,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Offset from the most recent message (default: 0). Use this to paginate through older messages.",
          minimum: 0,
        },
      },
    },
  },
  execute: async (toolInput) => {
    const limit = (toolInput.limit as number | undefined) ?? 10;
    const offset = (toolInput.offset as number | undefined) ?? 0;

    logger.info({ limit, offset }, "Chat history request received");

    const results = await gramjsClient.getMessageHistory({ limit, offset });

    if (results.length === 0) logger.info({ limit, offset }, "No messages found in chat history");

    logger.info({ limit, offset, count: results.length }, "Chat history retrieved");
    return {
      limit,
      offset,
      results: results.map((msg) => ({
        id: msg.id,
        text: msg.text,
        date: msg.date.toISOString(),
      })),
    };
  },
};
