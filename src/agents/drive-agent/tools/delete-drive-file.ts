import type { Tool } from "agents/agent";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";

export const deleteDriveFileTool: Tool = {
  definition: {
    name: "delete_drive_file",
    description:
      "Move a file or folder to trash in Google Drive. Use this when the user wants to delete a file or folder. The file will be moved to trash and can be recovered from there. Requires the file ID.",
    input_schema: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The ID of the file or folder to delete. Get this from list_drive_files or search_drive_files.",
        },
      },
      required: ["file_id"],
    },
  },
  execute: async (toolInput) => {
    const fileId = toolInput.file_id as string;

    logger.info({ fileId }, "Deleting Drive file");

    const drive = getDriveClient();

    const metadata = await drive.files.get({
      fileId,
      fields: "id, name, mimeType",
    });

    const fileName = metadata.data.name;
    const isFolder = metadata.data.mimeType === "application/vnd.google-apps.folder";

    await drive.files.update({
      fileId,
      requestBody: {
        trashed: true,
      },
    });

    logger.info({ fileId, fileName, isFolder }, "Drive file moved to trash");

    return {
      success: true,
      file_id: fileId,
      file_name: fileName,
      is_folder: isFolder,
      message: `${isFolder ? "Folder" : "File"} "${fileName}" moved to trash`,
    };
  },
};
