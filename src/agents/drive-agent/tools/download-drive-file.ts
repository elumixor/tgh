import type { Readable } from "node:stream";
import type { Tool } from "agents/agent";
import type { Context } from "grammy";
import { InputFile } from "grammy";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";
import { createProgressHandler } from "utils/progress-handler";

export const downloadDriveFileTool: Tool = {
  definition: {
    name: "download_drive_file",
    description:
      "Download a file from Google Drive and send it to Telegram. Use this when the user wants to retrieve a file from their Drive. Requires the file ID which can be obtained from list_drive_files or search_drive_files tools.",
    input_schema: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The ID of the file to download. Get this from list_drive_files or search_drive_files.",
        },
      },
      required: ["file_id"],
    },
  },
  execute: async (toolInput, context) => {
    const fileId = toolInput.file_id as string;

    logger.info({ fileId }, "Downloading Drive file");

    if (!context?.telegramCtx) throw new Error("Telegram context required for file download");

    return await downloadAndSendFile(fileId, context.telegramCtx, context.messageId);
  },
};

async function downloadAndSendFile(fileId: string, ctx: Context, messageId?: number) {
  const progress = messageId ? createProgressHandler(ctx, messageId) : null;

  try {
    await progress?.updateProgress({ text: "📥 Fetching file metadata..." });

    const drive = getDriveClient();
    const metadata = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
    });

    const fileName = metadata.data.name || "download";
    const fileSize = metadata.data.size ? Number.parseInt(metadata.data.size, 10) : undefined;

    logger.info({ fileId, fileName, fileSize }, "File metadata retrieved");

    await progress?.updateProgress({ text: `📥 Downloading ${fileName}...` });

    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      { responseType: "stream" },
    );

    const stream = response.data as unknown as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    const fileBuffer = Buffer.concat(chunks);

    logger.info({ fileId, fileName, downloadedSize: fileBuffer.length }, "File downloaded");

    await progress?.updateProgress({ text: `📤 Uploading ${fileName} to Telegram...` });

    const inputFile = new InputFile(fileBuffer, fileName);

    await ctx.replyWithDocument(inputFile, {
      caption: `📎 ${fileName}\n${fileSize ? `Size: ${formatBytes(fileSize)}` : ""}`,
      reply_parameters: messageId ? { message_id: messageId } : undefined,
      message_thread_id: ctx.message?.message_thread_id,
    });

    return {
      success: true,
      file_id: fileId,
      file_name: fileName,
      file_size: fileBuffer.length,
      message: "File downloaded and sent successfully",
    };
  } catch (error) {
    logger.error({ fileId, error: error instanceof Error ? error.message : error }, "File download failed");
    await progress?.showError(`Failed to download file: ${error instanceof Error ? error.message : "Unknown error"}`);
    throw error;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
