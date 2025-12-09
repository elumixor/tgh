import type { Tool } from "agents/agent";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";

export const renameDriveFileTool: Tool = {
  definition: {
    name: "rename_drive_file",
    description:
      "Rename a file or folder in Google Drive. Use this when the user wants to change the name of an existing file or folder. Requires the file ID and the new name.",
    input_schema: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The ID of the file or folder to rename. Get this from list_drive_files or search_drive_files.",
        },
        new_name: {
          type: "string",
          description: "The new name for the file or folder.",
        },
      },
      required: ["file_id", "new_name"],
    },
  },
  execute: async (toolInput) => {
    const fileId = toolInput.file_id as string;
    const newName = toolInput.new_name as string;

    logger.info({ fileId, newName }, "Renaming Drive file");

    const drive = getDriveClient();

    const beforeMetadata = await drive.files.get({
      fileId,
      fields: "id, name",
    });

    const oldName = beforeMetadata.data.name;

    const response = await drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
      fields: "id, name, webViewLink",
    });

    logger.info({ fileId, oldName, newName }, "Drive file renamed");

    return {
      success: true,
      file_id: response.data.id,
      old_name: oldName,
      new_name: response.data.name,
      web_view_link: response.data.webViewLink,
      message: `File renamed from "${oldName}" to "${newName}"`,
    };
  },
};
