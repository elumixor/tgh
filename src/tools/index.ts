import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";
import { addMemoryTool } from "./add-memory";
import { editImageTool } from "./edit-image";
import { generate3DFromImageTool } from "./generate-3d-from-image";
import { generateImageTool } from "./generate-image";
import { getChatInfoTool } from "./get-chat-info";
import { getGDDPageTool } from "./get-gdd-page";
import { getMemoryTool } from "./get-memory";
import { getMessageHistoryTool } from "./get-message-history";
import { getMessageInfoTool } from "./get-message-info";
import { getMessageMentionsTool } from "./get-message-mentions";
import { searchGDDTool } from "./search-gdd";
import { searchMemoriesTool } from "./search-memories";
import { searchMessagesTool } from "./search-messages";
import { transcribeVoiceTool } from "./transcribe-voice";
import type { Tool, ToolContext } from "./types";
import { updateMemoryTool } from "./update-memory";
import { webSearchTool } from "./web-search";

const allTools: Tool[] = [
  generate3DFromImageTool,
  generateImageTool,
  editImageTool,
  searchMessagesTool,
  getMessageMentionsTool,
  getMessageHistoryTool,
  getMessageInfoTool,
  getChatInfoTool,
  transcribeVoiceTool,
  webSearchTool,
  searchGDDTool,
  getGDDPageTool,
  searchMemoriesTool,
  addMemoryTool,
  updateMemoryTool,
  getMemoryTool,
];

export const tools: Anthropic.Tool[] = allTools.map((tool) => tool.definition);

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context?: ToolContext,
): Promise<unknown> {
  logger.info({ tool: toolName, input: toolInput }, "Tool called");
  const tool = allTools.find((t) => t.definition.name === toolName);
  if (!tool) {
    logger.warn({ tool: toolName }, "Unknown tool");
    return { error: "Unknown tool" };
  }
  const result = await tool.execute(toolInput, context);
  logger.info({ tool: toolName, result }, "Tool result");
  return result;
}

export type { ToolContext } from "./types";
