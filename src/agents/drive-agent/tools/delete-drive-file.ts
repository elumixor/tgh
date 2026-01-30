import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";
import { z } from "zod";

export const deleteDriveFileTool: ToolDefinition = {
  name: "delete_drive_file",
  description:
    "Move a file or folder to trash in Google Drive. Use this when the user wants to delete a file or folder. The file will be moved to trash and can be recovered from there. Requires the file ID.",
  parameters: z.object({
    file_id: z
      .string()
      .describe("The ID of the file or folder to delete. Get this from list_drive_files or search_drive_files."),
  }),
  execute: async ({ file_id }) => {
    logger.info({ fileId: file_id }, "Deleting Drive file");

    const drive = getDriveClient();
    const metadata = await drive.files.get({ fileId: file_id, fields: "id, name, mimeType" });

    const fileName = metadata.data.name;
    const isFolder = metadata.data.mimeType === "application/vnd.google-apps.folder";

    await drive.files.update({ fileId: file_id, requestBody: { trashed: true } });

    logger.info({ fileId: file_id, fileName, isFolder }, "Drive file moved to trash");

    return {
      success: true,
      file_id,
      file_name: fileName,
      is_folder: isFolder,
      message: `${isFolder ? "Folder" : "File"} "${fileName}" moved to trash`,
    };
  },
};
