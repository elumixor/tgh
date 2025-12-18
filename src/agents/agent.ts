import { Anthropic } from "@anthropic-ai/sdk";
import { env } from "env";
import type { Context } from "grammy";
import type { FileData } from "io/output";
import { logger } from "logger";

const MAX_TOOL_ITERATIONS = 10;

export type AgentResponse = { success: true; result: string } | { success: false; error?: string };

export interface ToolProgress {
  type: "tool_start" | "tool_complete" | "tool_error" | "status";
  toolName?: string;
  input?: unknown;
  result?: unknown;
  error?: string;
  message?: string;
}

export interface ToolContext {
  telegramCtx?: Context;
  messageId?: number;
  verbose?: boolean;
  onProgress?: (progress: ToolProgress) => void;
  onFile?: (file: FileData) => void;
}

export interface Tool {
  definition: Anthropic.Tool;
  execute: (toolInput: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}

export abstract class Agent implements Tool {
  protected client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  public abstract readonly definition: Anthropic.Tool;

  constructor(
    public readonly name: string,
    public readonly model: string,
    public readonly systemPrompt: string,
    public tools: Tool[],
    public readonly maxTokens: number,
    public readonly thinkingBudget?: number,
  ) {}

  async execute(toolInput: Record<string, unknown>, context: ToolContext): Promise<unknown> {
    const task = toolInput.task as string;
    if (!task) throw new Error("Task is required");

    const response = await this.processTask(task, context);
    if (!response.success) throw new Error(response.error ?? "Agent task failed");

    return { result: response.result };
  }

  async processTask(task: string, context: ToolContext = {}): Promise<AgentResponse> {
    const taskId = Math.random().toString(36).substring(2, 9);
    const taskPreview = task.length > 100 ? `${task.substring(0, 100)}...` : task;
    const verbose = context.verbose ?? false;

    const thinking = this.thinkingBudget
      ? ({ type: "enabled", budget_tokens: this.thinkingBudget } as const)
      : undefined;

    if (verbose) {
      logger.info(
        {
          taskId,
          agent: this.name,
          model: this.model,
          thinking: this.thinkingBudget !== undefined,
          maxTokens: this.maxTokens,
          toolCount: this.tools.length,
        },
        `[${taskId}] ${this.name} starting: ${taskPreview}`,
      );
    }

    try {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

      if (verbose) logger.info({ taskId, agent: this.name }, `[${taskId}] Calling API (initial)`);
      let response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        tools: this.tools.map((t) => t.definition),
        messages,
        thinking,
      });

      let iterations = 0;
      while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        const toolUses = response.content.filter((b) => b.type === "tool_use");
        if (toolUses.length === 0) break;

        if (verbose) {
          logger.info(
            {
              taskId,
              agent: this.name,
              iteration: iterations,
              toolCount: toolUses.length,
              tools: toolUses.map((t) => (t.type === "tool_use" ? t.name : "unknown")),
            },
            `[${taskId}] Iteration ${iterations}: ${toolUses.length} tool(s)`,
          );
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // Execute all tools in parallel
        const toolExecutions = toolUses
          .filter((t) => t.type === "tool_use")
          .map(async (toolUse) => {
            if (toolUse.type !== "tool_use") return null;

            const toolLogId = Math.random().toString(36).substring(2, 7);
            const tool = this.tools.find((t) => t.definition.name === toolUse.name);
            if (!tool) {
              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ error: `Tool ${toolUse.name} not found` }),
                is_error: true,
              };
            }

            context.onProgress?.({
              type: "tool_start",
              toolName: toolUse.name,
              input: toolUse.input,
            });

            try {
              if (verbose) {
                const inputStr = JSON.stringify(toolUse.input);
                const inputPreview = inputStr.length > 150 ? `${inputStr.substring(0, 150)}...` : inputStr;
                logger.info(
                  { taskId, toolId: toolLogId, agent: this.name, tool: toolUse.name },
                  `[${taskId}:${toolLogId}] → ${toolUse.name}(${inputPreview})`,
                );
              }

              const result = await tool.execute(toolUse.input as Record<string, unknown>, context);

              // Check for file outputs
              if (result && typeof result === "object" && "files" in result) {
                const files = (result as { files: FileData[] }).files;
                if (Array.isArray(files)) {
                  for (const file of files) context.onFile?.(file);
                }
              }

              const resultStr = JSON.stringify(result);

              context.onProgress?.({
                type: "tool_complete",
                toolName: toolUse.name,
                input: toolUse.input,
                result,
              });

              if (verbose) {
                const fullPreview = resultStr.length > 200 ? `${resultStr.substring(0, 200)}...` : resultStr;
                logger.info(
                  { taskId, toolId: toolLogId, agent: this.name, tool: toolUse.name, resultLength: resultStr.length },
                  `[${taskId}:${toolLogId}] ✓ ${toolUse.name}: ${fullPreview}`,
                );
              }

              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: resultStr,
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);

              context.onProgress?.({
                type: "tool_error",
                toolName: toolUse.name,
                input: toolUse.input,
                error: errorMessage,
              });

              if (verbose) {
                logger.error(
                  { taskId, toolId: toolLogId, agent: this.name, tool: toolUse.name, error: errorMessage },
                  `[${taskId}:${toolLogId}] ✗ ${toolUse.name} failed: ${errorMessage}`,
                );
              }

              return {
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ error: errorMessage }),
                is_error: true,
              };
            }
          });

        const results = await Promise.all(toolExecutions);
        for (const result of results) {
          if (result !== null) toolResults.push(result);
        }

        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });

        if (verbose) {
          logger.info(
            { taskId, agent: this.name, iteration: iterations },
            `[${taskId}] Calling API (iteration ${iterations})`,
          );
        }
        response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: this.systemPrompt,
          tools: this.tools.map((t) => t.definition),
          messages,
          thinking,
        });
      }

      const textBlock = response.content.find((b) => b.type === "text");
      const result = textBlock && textBlock.type === "text" ? textBlock.text : "No response";

      if (verbose) {
        const resultPreview = result.length > 150 ? `${result.substring(0, 150)}...` : result;
        logger.info(
          {
            taskId,
            agent: this.name,
            iterations,
            resultLength: result.length,
            stopReason: response.stop_reason,
          },
          `[${taskId}] ✓ ${this.name} completed (${iterations} iterations): ${resultPreview}`,
        );
      }

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (verbose) {
        logger.error({ taskId, agent: this.name, error }, `[${taskId}] ✗ ${this.name} failed`);
      }

      return { success: false, error: errorMessage };
    }
  }
}
