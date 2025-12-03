import { logger } from "../logger";
import { type DriveFile, formatDriveFile, getDriveClient } from "../services/google-drive";
import type { Tool } from "./types";

export const searchDriveFilesTool: Tool = {
  definition: {
    name: "search_drive_files",
    description:
      "Search for files and folders in Google Drive by name or other criteria. Returns matching files with detailed information. Use this when you need to find specific files without knowing their exact location.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Can be a filename or part of it. The search is case-insensitive and will match partial names.",
        },
        mime_type: {
          type: "string",
          description:
            "Optional MIME type filter. Examples: 'application/vnd.google-apps.folder' for folders, 'application/pdf' for PDFs, 'image/jpeg' for JPEG images.",
        },
        folder_id: {
          type: "string",
          description:
            "Optional folder ID to search within. If not provided, searches the entire Drive. Use this to narrow down search results to a specific folder.",
        },
        page_size: {
          type: "number",
          description: "Maximum number of results to return. Defaults to 50. Maximum is 1000.",
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput) => {
    const query = toolInput.query as string;
    const mimeType = toolInput.mime_type as string | undefined;
    const folderId = toolInput.folder_id as string | undefined;
    const pageSize = Math.min((toolInput.page_size as number) || 50, 1000);

    logger.info({ query, mimeType, folderId, pageSize }, "Searching Drive files");

    const queryParts = [`name contains '${query}'`, "trashed = false"];
    if (mimeType) queryParts.push(`mimeType = '${mimeType}'`);
    if (folderId) queryParts.push(`'${folderId}' in parents`);

    const searchQuery = queryParts.join(" and ");

    const drive = getDriveClient();
    const response = await drive.files.list({
      q: searchQuery,
      pageSize,
      fields: "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, iconLink)",
      orderBy: "folder,name",
    });

    const files: DriveFile[] = (response.data.files || []).map(formatDriveFile);

    logger.info({ query, resultCount: files.length }, "Drive search completed");

    return {
      query,
      total_results: files.length,
      files,
    };
  },
};
