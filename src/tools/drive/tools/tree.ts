import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const treeDriveTool = defineTool(
  "TreeDrive",
  "Display Google Drive folder hierarchy as a tree. Returns structured data with nested folders and files.",
  z.object({
    folder_id: z.string().nullable().describe("Root folder ID, or null to show all shared folders."),
    depth: z.number().nullable().describe("How many levels deep (default: 3, max: 10)"),
    show_files: z.boolean().nullable().describe("Include files, not just folders (default: true)"),
  }),
  async ({ folder_id, depth, show_files }) => {
    const tree = await google.drive.tree(folder_id ?? undefined, Math.min(depth ?? 3, 10), show_files ?? true);
    return tree.map((n) => n.toXML()).join("\n");
  },
);
