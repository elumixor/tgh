import { gramjsClient } from "../gramjs-client";
import { logger } from "../logger";
import type { Tool } from "./types";

export const getMessageInfoTool: Tool = {
  definition: {
    name: "get_message_info",
    description:
      "Get detailed information about a specific message by ID, including text, media (voice, photo, document), sender, and date. Use when you need to understand what a referenced message contains.",
    input_schema: {
      type: "object",
      properties: {
        message_id: {
          type: "number",
          description: "The ID of the message to get info for",
        },
      },
      required: ["message_id"],
    },
  },
  execute: async (toolInput) => {
    const messageId = toolInput.message_id as number;
    logger.info({ messageId }, "Message info request received");

    try {
      const messageInfo = await gramjsClient.getMessageInfo(messageId);
      logger.info({ messageId, hasVoice: !!messageInfo.voice }, "Message info retrieved");
      return { success: true, ...messageInfo };
    } catch (error) {
      logger.error({ messageId, error: error instanceof Error ? error.message : error }, "Failed to get message info");
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
};
