import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const copyFile = defineTool(
  "CopyFile",
  "Copy a Google Drive file to a new location with a new name",
  z.object({
    fileId: z.string().describe("The ID of the template document to copy"),
    title: z.string().describe("The name for the new document"),
    targetFolderId: z
      .string()
      .nullable()
      .describe("Folder ID to place the copy in, or null if it should be placed in the root"),
  }),
  async ({ fileId, title, targetFolderId }) => {
    const file = await google.drive.copy(fileId, title, targetFolderId ?? undefined);
    return file.toXML();
  },
);
