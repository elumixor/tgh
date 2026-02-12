import { gramjsClient } from "services/telegram";
import { defineTool } from "streaming-agent";
import { saveTempFile } from "utils";
import { z } from "zod";

export const downloadAttachmentTool = defineTool(
  "DownloadAttachment",
  "Download an attachment (photo, document, file) from a Telegram message by its message ID. Returns the local temp file path, file name, and MIME type. Use this to get files referenced in message XML (e.g. <photo>, <file> tags).",
  z.object({
    messageId: z.number().describe("The message ID containing the attachment"),
    chatType: z.enum(["private", "group"]).default("group").describe("Which chat the message is in"),
  }),
  async ({ messageId, chatType }, { botChatId, groupChatId }) => {
    const chatId = chatType === "private" ? botChatId : groupChatId;
    const { buffer, fileName, mimeType } = await gramjsClient.downloadMedia(chatId, messageId);
    const ext = fileName.includes(".") ? (fileName.split(".").pop() ?? "bin") : (mimeType.split("/").pop() ?? "bin");
    const path = await saveTempFile(buffer, ext);
    return { path, fileName, mimeType };
  },
);
