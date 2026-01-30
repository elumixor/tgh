import type { Readable } from "node:stream";
import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";
import { saveTempFile } from "utils/files";
import { z } from "zod";

export const downloadDriveFileTool: ToolDefinition = {
  name: "download_drive_file",
  description:
    "Download a file from Google Drive to a local temp file. Returns the file path for further processing (upload to Drive, analyze, use as reference). The file will be automatically sent to the user via output handler.",
  parameters: z.object({
    file_id: z
      .string()
      .describe("The ID of the file to download. Get this from list_drive_files or search_drive_files."),
  }),
  execute: async ({ file_id }) => {
    if (file_id.length < 20) {
      return {
        error: `Invalid file ID "${file_id}" - appears truncated (${file_id.length} chars). Google Drive IDs are 28-33 characters. Use search_drive_files to find the file first.`,
      };
    }

    logger.info({ fileId: file_id }, "Downloading Drive file");

    const drive = getDriveClient();

    const metadata = await drive.files
      .get({ fileId: file_id, fields: "id, name, mimeType, size" })
      .catch((error: unknown) => {
        const gaxiosError = error as { code?: number; message?: string };
        if (gaxiosError.code === 404) {
          throw new Error(
            `Google Drive API: File "${file_id}" not found or not accessible. Verify the ID is complete and correct.`,
          );
        }
        throw new Error(`Google Drive API error: ${gaxiosError.message ?? "Unknown error"}`);
      });

    const fileName = metadata.data.name ?? "download";
    const mimeType = metadata.data.mimeType ?? "application/octet-stream";
    const fileSize = metadata.data.size ? Number.parseInt(metadata.data.size, 10) : undefined;

    logger.info({ fileId: file_id, fileName, mimeType, fileSize }, "File metadata retrieved");

    const response = await drive.files.get({ fileId: file_id, alt: "media" }, { responseType: "stream" });
    const stream = response.data as unknown as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    const fileBuffer = Buffer.concat(chunks);
    const ext = getExtension(fileName, mimeType);
    const tempPath = await saveTempFile(fileBuffer, ext);

    logger.info({ fileId: file_id, fileName, tempPath, size: fileBuffer.length }, "File downloaded to temp");

    return {
      success: true,
      file_id,
      file_name: fileName,
      mime_type: mimeType,
      size: fileBuffer.length,
      path: tempPath,
      files: [
        {
          path: tempPath,
          mimeType,
          filename: fileName,
          caption: `📎 ${fileName}${fileSize ? ` (${formatBytes(fileSize)})` : ""}`,
        },
      ],
    };
  },
};

function getExtension(fileName: string, mimeType: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex !== -1) return fileName.slice(dotIndex + 1);

  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/json": "json",
  };
  return mimeToExt[mimeType] ?? "bin";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
