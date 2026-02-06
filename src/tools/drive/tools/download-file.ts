import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { saveTempFile } from "utils/files";
import { z } from "zod";

export const downloadDriveFileTool = defineTool(
  "DownloadDriveFile",
  "Download a file from Google Drive. Returns the file which will be automatically sent to the user.",
  z.object({
    file_id: z.string().describe("The ID of the file to download"),
  }),
  async ({ file_id }) => {
    const file = await google.drive.get(file_id);
    const fileName = file?.name ?? "download";
    const mimeType = file?.mimeType ?? "application/octet-stream";

    const fileBuffer = await google.drive.download(file_id);
    const ext = getExtension(fileName, mimeType);
    const tempPath = await saveTempFile(fileBuffer, ext);

    return {
      result: file?.toXML() ?? `<file id="${file_id}" />`,
      files: [
        {
          path: tempPath,
          mimeType,
          filename: fileName,
          caption: `${fileName}${file?.size ? ` (${formatBytes(file.size)})` : ""}`,
        },
      ],
    };
  },
);

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
