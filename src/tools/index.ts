import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";
import { editImageTool } from "./edit-image";
import { generate3DFromImageTool } from "./generate-3d-from-image";
import { generateImageTool } from "./generate-image";
import { getChatInfoTool } from "./get-chat-info";
import { getMessageHistoryTool } from "./get-message-history";
import { getMessageMentionsTool } from "./get-message-mentions";
import { searchMessagesTool } from "./search-messages";
import type { Tool, ToolContext } from "./types";
import { webSearchTool } from "./web-search";

const allTools: Tool[] = [
  generate3DFromImageTool,
  generateImageTool,
  editImageTool,
  searchMessagesTool,
  getMessageMentionsTool,
  getMessageHistoryTool,
  getChatInfoTool,
  webSearchTool,
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
