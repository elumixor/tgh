import { gramjsClient } from "services/telegram";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getChatInfoTool = defineTool(
  "GetGroupChatInfo",
  "Get information about the group chat including title, participant count, participants list, message count, first/last messages, and topics.",
  z.object({}),
  (_, context) => gramjsClient.getChatInfo(context.groupChatId),
);
