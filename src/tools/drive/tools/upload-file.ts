import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Context } from "grammy";
import { logger } from "logger";
import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { detectMimeType } from "utils/files";
import { z } from "zod";

export const uploadDriveFileTool = defineTool(
  "UploadDriveFile",
  "Upload a file to Google Drive from Telegram message, local path, URL, or base64 data.",
  z.object({
    message_id: z.number().nullable().describe("Telegram message ID containing the file"),
    file_path: z.string().nullable().describe("Local file path (e.g., from download or temp files)"),
    url: z.string().nullable().describe("URL to download and upload to Drive"),
    base64_data: z.string().nullable().describe("Base64-encoded file data (use with mime_type)"),
    mime_type: z.string().nullable().describe("MIME type for base64 data (required with base64_data)"),
    folder_id: z.string().describe("Destination folder ID (required)"),
    file_name: z.string().nullable().describe("Custom filename (inferred from source if not provided)"),
  }),
  async ({ message_id, file_path, url, base64_data, mime_type, folder_id, file_name }, context) => {
    let buffer: Buffer;
    let inferredFileName: string;
    let mimeType: string;

    if (message_id) {
      if (!context?.telegramContext) throw new Error("Telegram context not available");
      const result = await getFileFromTelegram(message_id, context.telegramContext);
      buffer = result.buffer;
      inferredFileName = result.fileName;
      mimeType = result.mimeType;
    } else if (file_path) {
      buffer = await fs.readFile(file_path);
      inferredFileName = path.basename(file_path);
      mimeType = detectMimeType(file_path);
    } else if (url) {
      const result = await getFileFromUrl(url);
      buffer = result.buffer;
      inferredFileName = result.fileName;
      mimeType = result.mimeType;
    } else if (base64_data) {
      buffer = Buffer.from(base64_data, "base64");
      inferredFileName = "upload";
      mimeType = mime_type ?? "application/octet-stream";
    } else {
      throw new Error("No file source provided");
    }

    const uploadedFile = await google.drive.upload(file_name ?? inferredFileName, buffer, mimeType, folder_id);

    return uploadedFile.toXML();
  },
);

async function getFileFromUrl(url: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const urlPath = new URL(url).pathname;
  const fileName = path.basename(urlPath) || "download";
  let mimeType = response.headers.get("content-type") ?? "application/octet-stream";
  if (mimeType === "application/octet-stream") mimeType = detectMimeType(fileName);

  return { buffer, fileName, mimeType };
}

async function getFileFromTelegram(
  messageId: number,
  telegramContext: Context,
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  if (!telegramContext.chat) throw new Error("No chat context available");

  const chatId = telegramContext.chat.id;
  const message = await telegramContext.api.forwardMessage(chatId, chatId, messageId);

  let fileId: string | undefined;
  let fileName: string | undefined;
  let mimeType = "application/octet-stream";

  if (message.document) {
    fileId = message.document.file_id;
    fileName = message.document.file_name;
    mimeType = message.document.mime_type ?? "application/octet-stream";
  } else if (message.photo && message.photo.length > 0) {
    const photo = message.photo[message.photo.length - 1];
    if (photo) {
      fileId = photo.file_id;
      fileName = `photo_${messageId}.jpg`;
      mimeType = "image/jpeg";
    }
  } else if (message.video) {
    fileId = message.video.file_id;
    fileName = message.video.file_name ?? `video_${messageId}.mp4`;
    mimeType = message.video.mime_type ?? "video/mp4";
  } else if (message.audio) {
    fileId = message.audio.file_id;
    fileName = message.audio.file_name ?? `audio_${messageId}.mp3`;
    mimeType = message.audio.mime_type ?? "audio/mpeg";
  } else if (message.voice) {
    fileId = message.voice.file_id;
    fileName = `voice_${messageId}.ogg`;
    mimeType = message.voice.mime_type ?? "audio/ogg";
  }

  if (!fileId) throw new Error(`Message ${messageId} does not contain a file`);

  const file = await telegramContext.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${telegramContext.api.token}/${file.file_path}`;
  const response = await fetch(fileUrl);

  if (!response.ok) throw new Error(`Failed to download file: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await telegramContext.api.deleteMessage(chatId, message.message_id);

  logger.info({ messageId, fileName, size: buffer.length, mimeType }, "Downloaded file from Telegram");

  return { buffer, fileName: fileName ?? `file_${messageId}`, mimeType };
}
