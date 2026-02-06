import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const listDriveFilesTool = defineTool(
  "ListDriveFiles",
  "List files and folders on user's Google Drive. Returns detailed info including IDs, names, types, sizes",
  z.object({
    folder_id: z.string().nullable().describe("Folder ID to list contents of"),
  }),
  async ({ folder_id }) => {
    const files = folder_id ? await google.drive.list(folder_id) : await google.drive.rootFolder();
    return files.map((f) => f.toXML()).join("\n");
  },
);
