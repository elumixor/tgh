import { logger } from "../logger";
import { type DriveFile, formatDriveFile, getDriveClient } from "../services/google-drive";
import type { Tool } from "./types";

export const listDriveFilesTool: Tool = {
  definition: {
    name: "list_drive_files",
    description:
      "List files and folders in a Google Drive folder. Returns detailed information about each file including ID, name, type, size, and timestamps. Use this to explore the Drive structure or find files in a specific folder.",
    input_schema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description:
            "The ID of the folder to list files from. If not provided and shared is false, lists files from root. If not provided and shared is true, lists all shared files. Special value 'shared' lists only top-level shared files and folders.",
        },
        shared: {
          type: "boolean",
          description:
            "If true, lists files shared with this account. Defaults to false. When true and no folder_id is provided, lists all top-level shared items.",
        },
        page_size: {
          type: "number",
          description: "Maximum number of files to return. Defaults to 100. Maximum is 1000.",
        },
      },
    },
  },
  execute: async (toolInput) => {
    const shared = (toolInput.shared as boolean) || false;
    const folderId = (toolInput.folder_id as string) || (shared ? undefined : "root");
    const pageSize = Math.min((toolInput.page_size as number) || 100, 1000);

    let query: string;
    if (shared && !folderId) {
      query = "sharedWithMe = true and trashed = false";
    } else if (folderId) {
      query = `'${folderId}' in parents and trashed = false`;
    } else {
      query = "'root' in parents and trashed = false";
    }

    logger.info({ folderId, pageSize, shared, query }, "Listing Drive files");

    const drive = getDriveClient();
    const response = await drive.files.list({
      q: query,
      pageSize,
      fields: "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink)",
      orderBy: "folder,name",
    });

    const files: DriveFile[] = (response.data.files || []).map(formatDriveFile);

    logger.info({ folderId, fileCount: files.length, shared }, "Drive files listed");

    return {
      folder_id: folderId || "shared",
      shared,
      total_files: files.length,
      files,
    };
  },
};
