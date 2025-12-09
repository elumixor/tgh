import { Agent } from "agents/agent";
import { models } from "models";
import { createDriveFolderTool } from "./tools/create-drive-folder";
import { deleteDriveFileTool } from "./tools/delete-drive-file";
import { downloadDriveFileTool } from "./tools/download-drive-file";
import { listDriveFilesTool } from "./tools/list-drive-files";
import { renameDriveFileTool } from "./tools/rename-drive-file";
import { searchDriveFilesTool } from "./tools/search-drive-files";
import { uploadDriveFileTool } from "./tools/upload-drive-file";

const DRIVE_AGENT_PROMPT = `You are the GOOGLE DRIVE AGENT, specialized in managing files and folders on Google Drive.

Your tools:
- list_drive_files: List files/folders in a specific folder
- search_drive_files: Search for files/folders by name
- download_drive_file: Download a file and send it to Telegram
- upload_drive_file: Upload a file from Telegram to Drive
- rename_drive_file: Rename a file or folder
- delete_drive_file: Move a file or folder to trash

Guidelines:
1. Always get file/folder IDs before performing operations
2. Use search when user doesn't know exact location
3. Use list to explore folder contents
4. For downloads: first find the file, then download it
5. For uploads: get message_id from user, optionally a target folder
6. Always confirm destructive operations (rename/delete) with clear results
7. Provide file IDs and links in responses

Response style:
- Clear confirmations of actions
- Include file IDs for reference
- Provide web links when available
- Use bullet points for multiple files
- Be specific about what was done

Important:
- File IDs are permanent identifiers
- "root" is the root folder ID
- Folders have mimeType "application/vnd.google-apps.folder"
- Always check if operations succeeded`;

export class DriveAgent extends Agent {
  readonly definition = {
    name: "drive_agent",
    description:
      "Google Drive management agent. Use for listing, searching, uploading, downloading, renaming, and deleting files/folders on Google Drive.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The Google Drive operation to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "drive_agent",
      models.thinking,
      DRIVE_AGENT_PROMPT,
      [
        listDriveFilesTool,
        createDriveFolderTool,
        searchDriveFilesTool,
        downloadDriveFileTool,
        uploadDriveFileTool,
        renameDriveFileTool,
        deleteDriveFileTool,
      ],
      3072,
      1024,
    );
  }
}
