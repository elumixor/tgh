import type { Tool } from "agents/agent";
import { logger } from "logger";
import { gramjsClient } from "services/telegram";

export const getChatInfoTool: Tool = {
  definition: {
    name: "get_chat_info",
    description:
      "Get overall information about the current Telegram chat including total message count, participant details, chat title, and basic statistics. Use when user asks about the chat overview, participant list, or general chat information.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  execute: async () => {
    logger.info("Chat info request received");

    const chatInfo = await gramjsClient.getChatInfo();

    logger.info({ chatInfo }, "Chat info retrieved");
    return chatInfo;
  },
};
