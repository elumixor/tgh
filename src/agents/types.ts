import type { Context } from "grammy";

export interface ToolContext {
  telegramCtx?: Context;
  messageId?: number;
}

export interface AgentResponse {
  success: boolean;
  result?: string;
  error?: string;
  toolsUsed: string[];
  thinkingUsed: boolean;
  executionTimeMs: number;
}
