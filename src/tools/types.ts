import type Anthropic from "@anthropic-ai/sdk";
import type { Context } from "grammy";

export interface ToolContext {
  telegramCtx?: Context;
  messageId?: number;
}

export interface Tool {
  definition: Anthropic.Tool;
  execute: (toolInput: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;
}
