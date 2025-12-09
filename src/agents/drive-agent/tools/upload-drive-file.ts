import { Readable } from "node:stream";
import type { Tool } from "agents/agent";
import { env } from "env";
import type { Context } from "grammy";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";
import { createProgressHandler } from "utils/progress-handler";

export const uploadDriveFileTool: Tool = {
  definition: {
    name: "upload_drive_file",
    description:
      "Upload a file from Telegram to Google Drive. The file must have been sent in the current or a recent message. IMPORTANT: You must specify a folder_id - service accounts cannot upload to root. Use list_drive_files to get folder IDs, or create_drive_folder to create a new folder first.",
    input_schema: {
      type: "object",
      properties: {
        message_id: {
          type: "number",
          description:
            "The Telegram message ID containing the file to upload. This should be a message with a document/file attachment.",
        },
        folder_id: {
          type: "string",
          description:
            "The folder ID where to upload the file. REQUIRED - service accounts cannot upload to root. Get folder IDs from list_drive_files or create a folder with create_drive_folder first.",
        },
        file_name: {
          type: "string",
          description: "Optional custom name for the file on Drive. If not provided, uses the original filename.",
        },
      },
      required: ["message_id", "folder_id"],
    },
  },
  execute: async (toolInput, context) => {
    const messageId = toolInput.message_id as number;
    const folderId = toolInput.folder_id as string;
    const customFileName = toolInput.file_name as string | undefined;

    logger.info({ messageId, folderId, customFileName }, "Uploading file to Drive");

    if (!context?.telegramCtx) throw new Error("Telegram context required for file upload");

    return await uploadFileFromTelegram(messageId, folderId, customFileName, context.telegramCtx);
  },
};

async function uploadFileFromTelegram(
  messageId: number,
  folderId: string,
  customFileName: string | undefined,
  ctx: Context,
) {
  const progress = createProgressHandler(ctx, messageId);

  try {
    await progress.updateProgress({ text: "📥 Fetching file from Telegram..." });

    const message = await ctx.api.getChat(ctx.chat?.id ?? 0).then(async (chat) => {
      return ctx.api.forwardMessage(chat.id, chat.id, messageId);
    });

    let fileId: string | undefined;
    let fileName: string | undefined;

    if (message.document) {
      fileId = message.document.file_id;
      fileName = message.document.file_name;
    } else if (message.photo) {
      fileId = message.photo.at(-1)?.file_id;
      fileName = "photo.jpg";
    } else if (message.video) {
      fileId = message.video.file_id;
      fileName = message.video.file_name || "video.mp4";
    } else throw new Error("No file found in the specified message");

    if (!fileId) throw new Error("File ID not found");

    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    logger.info({ messageId, fileName, fileUrl }, "File info retrieved");

    await progress.updateProgress({ text: `📥 Downloading ${fileName}...` });

    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    logger.info({ messageId, fileName, size: buffer.length }, "File downloaded from Telegram");

    await progress.updateProgress({ text: `☁️ Uploading to Google Drive...` });

    const finalFileName = customFileName || fileName || "upload";

    const drive = getDriveClient();
    const driveResponse = await drive.files.create({
      requestBody: {
        name: finalFileName,
        parents: [folderId],
      },
      media: {
        mimeType: "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id, name, webViewLink",
    });

    const uploadedFile = driveResponse.data;

    logger.info({ fileId: uploadedFile.id, fileName: uploadedFile.name }, "File uploaded to Drive");

    await ctx.reply(
      `✅ File uploaded successfully!\n\n📎 ${uploadedFile.name}\n🆔 File ID: ${uploadedFile.id}\n🔗 ${uploadedFile.webViewLink || "N/A"}`,
      {
        reply_parameters: { message_id: messageId },
        message_thread_id: ctx.message?.message_thread_id,
      },
    );

    return {
      success: true,
      file_id: uploadedFile.id,
      file_name: uploadedFile.name,
      web_view_link: uploadedFile.webViewLink,
      message: "File uploaded successfully",
    };
  } catch (error) {
    logger.error({ messageId, error: error instanceof Error ? error.message : error }, "File upload failed");
    await progress.showError(`Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  }
}
