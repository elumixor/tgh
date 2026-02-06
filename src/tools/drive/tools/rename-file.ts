import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const renameDriveFileTool = defineTool(
  "RenameDriveFile",
  "Rename a file or folder in Google Drive.",
  z.object({
    file_id: z.string().describe("The ID of the file or folder to rename"),
    new_name: z.string().describe("The new name for the file or folder"),
  }),
  async ({ file_id, new_name }) => {
    const renamed = await google.drive.rename(file_id, new_name);
    return renamed.toXML();
  },
);
