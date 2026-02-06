import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const deleteDriveFileTool = defineTool(
  "DeleteDriveFile",
  "Move a file or folder to trash in Google Drive. Can be recovered from trash.",
  z.object({
    file_id: z.string().describe("The ID of the file or folder to delete"),
  }),
  async ({ file_id }) => {
    const file = await google.drive.get(file_id);
    await google.drive.delete(file_id);
    return `Deleted: ${file?.name ?? file_id}`;
  },
);
