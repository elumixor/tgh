import { logger } from "../logger";
import { type DriveFile, formatDriveFile, getDriveClient } from "../services/google-drive";
import type { Tool } from "./types";

export const createDriveFolderTool: Tool = {
  definition: {
    name: "create_drive_folder",
    description:
      "Create a new folder in Google Drive. The folder will be created inside the specified parent folder (which must be shared with the bot). Returns the new folder's ID which can be used for uploading files.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the folder to create.",
        },
        parent_folder_id: {
          type: "string",
          description:
            "The ID of the parent folder where to create the new folder. This must be a folder shared with the bot. Get folder IDs from list_drive_files or search_drive_files.",
        },
      },
      required: ["name", "parent_folder_id"],
    },
  },
  execute: async (toolInput) => {
    const name = toolInput.name as string;
    const parentFolderId = toolInput.parent_folder_id as string;

    logger.info({ name, parentFolderId }, "Creating Drive folder");

    const drive = getDriveClient();
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id, name, mimeType, createdTime, modifiedTime, parents, webViewLink, iconLink",
    });

    const folder: DriveFile = formatDriveFile(response.data);

    logger.info({ folderId: folder.id, name: folder.name }, "Drive folder created");

    return {
      success: true,
      folder,
      message: `Folder "${name}" created successfully`,
    };
  },
};
