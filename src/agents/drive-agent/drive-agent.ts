import { type AppContext, StreamingAgent } from "@agents/streaming-agent";
import { models } from "models";
import { z } from "zod";
import { createDriveFolderTool } from "./tools/create-drive-folder";
import { deleteDriveFileTool } from "./tools/delete-drive-file";
import { downloadDriveFileTool } from "./tools/download-drive-file";
import { listDriveFilesTool } from "./tools/list-drive-files";
import { renameDriveFileTool } from "./tools/rename-drive-file";
import { searchDriveFilesTool } from "./tools/search-drive-files";
import { treeDriveTool } from "./tools/tree-drive";
import { uploadDriveFileTool } from "./tools/upload-drive-file";

const DRIVE_AGENT_PROMPT = `You manage Google Drive files.

TOOLS:
- tree_drive: View folder hierarchy (use first to understand structure)
- search_drive_files: Rich query search (type:folder, *.png, /regex/, path:*, modified:>7d)
- list_drive_files: Browse folder contents
- download_drive_file: Download to temp path
- upload_drive_file: Upload from Telegram, path, URL, or base64
- create_drive_folder: Create new folder
- rename_drive_file / delete_drive_file: Manage files

ACTION RULES:
- Start with tree_drive or search to understand structure
- Use rich query syntax: "type:folder Assets", "*.png", "/concept.*art/i"
- Multiple items needed: fetch ALL in ONE iteration (parallel)
- download_drive_file returns a temp file path - use for further processing
- upload_drive_file accepts: message_id (Telegram), file_path, url, or base64_data

Response: File names, paths, IDs, webViewLinks. Be concise.`;

const DriveOutputSchema = z.object({
  operation: z.string(),
  files: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string().optional(),
      webViewLink: z.string().optional(),
      path: z.string().optional(),
    }),
  ),
  summary: z.string(),
});

export const driveAgent = new StreamingAgent<AppContext>({
  name: "drive_agent",
  model: models.thinking,
  instructions: DRIVE_AGENT_PROMPT,
  tools: [
    treeDriveTool,
    searchDriveFilesTool,
    listDriveFilesTool,
    downloadDriveFileTool,
    uploadDriveFileTool,
    createDriveFolderTool,
    renameDriveFileTool,
    deleteDriveFileTool,
  ],
  outputType: DriveOutputSchema,
});
