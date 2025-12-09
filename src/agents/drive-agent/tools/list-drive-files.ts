import type { Tool } from "agents/agent";
import { logger } from "logger";
import { type DriveFile, formatDriveFile, getDriveClient } from "services/google-drive/google-drive";

export const listDriveFilesTool: Tool = {
  definition: {
    name: "list_drive_files",
    description:
      "List files and folders in Google Drive. Returns detailed information about each file including ID, name, type, size, and timestamps. Use this to explore shared Drive folders or find files.",
    input_schema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description:
            "The ID of the folder to list files from. If not provided, lists all top-level shared folders. You can get folder IDs from previous list_drive_files or search_drive_files calls.",
        },
        page_size: {
          type: "number",
          description: "Maximum number of files to return. Defaults to 100. Maximum is 1000.",
        },
      },
    },
  },
  execute: async (toolInput) => {
    const folderId = toolInput.folder_id as string | undefined;
    const pageSize = Math.min((toolInput.page_size as number) || 100, 1000);

    const query = folderId ? `'${folderId}' in parents and trashed = false` : "sharedWithMe = true and trashed = false";

    logger.info({ folderId, pageSize, query }, "Listing Drive files");

    const drive = getDriveClient();
    const response = await drive.files.list({
      q: query,
      pageSize,
      fields: "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink)",
      orderBy: "folder,name",
    });

    const files: DriveFile[] = (response.data.files || []).map(formatDriveFile);

    logger.info({ folderId, fileCount: files.length }, "Drive files listed");

    return {
      folder_id: folderId || "shared",
      total_files: files.length,
      files,
    };
  },
};
