import { models } from "models";
import { StreamingAgent } from "streaming-agent";
import { copyFile } from "./tools/copy";
import { createDriveFolderTool } from "./tools/create-folder";
import { deleteDriveFileTool } from "./tools/delete-file";
import { downloadDriveFileTool } from "./tools/download-file";
import { exportDocPdfTool } from "./tools/export-doc-pdf";
import { listDriveFilesTool } from "./tools/list-files";
import { renameDriveFileTool } from "./tools/rename-file";
import { replaceDocTextTool } from "./tools/replace-doc-text";
import { searchDriveTool } from "./tools/search";
import { treeDriveTool } from "./tools/tree";
import { uploadDriveFileTool } from "./tools/upload-file";

const DRIVE_AGENT_PROMPT = `You work with files on Google Drive, including Google Docs.

You accept natural language requests for file operations.

Notes:
- Explore structure first (tree/search) before operations
- Use parallel operations when handling multiple files
- Output results in a concise, human-readable format.
- When presenting results, use markdown links, and never print ids, unless explicitly asked for.
- When request refers to id:root, you should understand that it is not the id of the root folder, but rather a special instruction to work with shared root folders. For tools you most likely should provide id: null.
`;

export const driveAgent = new StreamingAgent({
  name: "DriveAgent",
  model: models.thinking,
  modelSettings: { reasoning: { effort: "low" } },
  instructions: DRIVE_AGENT_PROMPT,
  tools: [
    treeDriveTool,
    searchDriveTool,
    listDriveFilesTool,
    downloadDriveFileTool,
    uploadDriveFileTool,
    createDriveFolderTool,
    renameDriveFileTool,
    deleteDriveFileTool,
    copyFile,
    replaceDocTextTool,
    exportDocPdfTool,
  ],
});
