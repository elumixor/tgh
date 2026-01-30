import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { getDriveClient } from "services/google-drive/google-drive";
import { z } from "zod";

export const renameDriveFileTool: ToolDefinition = {
  name: "rename_drive_file",
  description:
    "Rename a file or folder in Google Drive. Use this when the user wants to change the name of an existing file or folder. Requires the file ID and the new name.",
  parameters: z.object({
    file_id: z
      .string()
      .describe("The ID of the file or folder to rename. Get this from list_drive_files or search_drive_files."),
    new_name: z.string().describe("The new name for the file or folder."),
  }),
  execute: async ({ file_id, new_name }) => {
    logger.info({ fileId: file_id, newName: new_name }, "Renaming Drive file");

    const drive = getDriveClient();
    const beforeMetadata = await drive.files.get({ fileId: file_id, fields: "id, name" });
    const oldName = beforeMetadata.data.name;

    const response = await drive.files.update({
      fileId: file_id,
      requestBody: { name: new_name },
      fields: "id, name, webViewLink",
    });

    logger.info({ fileId: file_id, oldName, newName: new_name }, "Drive file renamed");

    return {
      success: true,
      file_id: response.data.id,
      old_name: oldName,
      new_name: response.data.name,
      web_view_link: response.data.webViewLink,
      message: `File renamed from "${oldName}" to "${new_name}"`,
    };
  },
};
