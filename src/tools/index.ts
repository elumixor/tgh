import type Anthropic from "@anthropic-ai/sdk";
import { editImageTool } from "./edit-image";
import { generate3DFromImageTool } from "./generate-3d-from-image";
import { generateImageTool } from "./generate-image";
import type { Tool, ToolContext } from "./types";

const allTools: Tool[] = [generate3DFromImageTool, generateImageTool, editImageTool];

export const tools: Anthropic.Tool[] = allTools.map((tool) => tool.definition);

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context?: ToolContext,
): Promise<string> {
  const tool = allTools.find((t) => t.definition.name === toolName);
  if (!tool) return "Unknown tool";
  return tool.execute(toolInput, context);
}

export type { ToolContext } from "./types";
