import { downloadAttachmentTool } from "./download-attachment";
import { getChatInfoTool } from "./get-group-chat-info";
import { getMessagesTool } from "./get-messages";
import { sendFileTool } from "./send-file";
import { updateMemoriesTool } from "./update-memories";
import { waitTool } from "./wait";

export { downloadAttachmentTool, getChatInfoTool, getMessagesTool, sendFileTool, updateMemoriesTool, waitTool };

export const coreTools = [
  downloadAttachmentTool,
  getChatInfoTool,
  getMessagesTool,
  sendFileTool,
  updateMemoriesTool,
  waitTool,
];
