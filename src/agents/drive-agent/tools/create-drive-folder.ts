import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { type DriveFile, formatDriveFile, getDriveClient } from "services/google-drive/google-drive";
import { z } from "zod";

export const createDriveFolderTool: ToolDefinition = {
  name: "create_drive_folder",
  description:
    "Create a new folder in Google Drive. The folder will be created inside the specified parent folder (which must be shared with the bot). Returns the new folder's ID which can be used for uploading files.",
  parameters: z.object({
    name: z.string().describe("The name of the folder to create."),
    parent_folder_id: z
      .string()
      .describe(
        "The ID of the parent folder where to create the new folder. This must be a folder shared with the bot. Get folder IDs from list_drive_files or search_drive_files.",
      ),
  }),
  execute: async ({ name, parent_folder_id }) => {
    logger.info({ name, parentFolderId: parent_folder_id }, "Creating Drive folder");

    const drive = getDriveClient();
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent_folder_id],
      },
      fields: "id, name, mimeType, createdTime, modifiedTime, parents, webViewLink, iconLink",
    });

    const folder: DriveFile = formatDriveFile(response.data);
    logger.info({ folderId: folder.id, name: folder.name }, "Drive folder created");

    return { success: true, folder, message: `Folder "${name}" created successfully` };
  },
};
