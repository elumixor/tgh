import { Anthropic } from "@anthropic-ai/sdk";
import { env } from "env";
import type { Context } from "grammy";
import type { BlockHandle, FileData, MessageHandle } from "io/types";
import { logger } from "logger";
import { summarizer } from "services/summarizer";

const MAX_TOOL_ITERATIONS = 10;

export type AgentResponse =
  | {
      success: true;
      result: string;
    }
  | {
      success: false;
      error?: string;
    };

export interface ToolContext {
  telegramCtx?: Context;
  messageId?: number;
  statusMessage: MessageHandle;
  parentBlock?: BlockHandle;
  verbose?: boolean;
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

  async processTask(task: string, context: ToolContext): Promise<AgentResponse> {
    const taskId = Math.random().toString(36).substring(2, 9);
    const taskPreview = task.length > 100 ? `${task.substring(0, 100)}...` : task;
    const verbose = context.verbose ?? false;

    // Create agent block - as child if parentBlock exists, otherwise as root
    const agentBlock = context.parentBlock
      ? context.parentBlock.addChild({ type: "agent", name: this.name, task: taskPreview })
      : context.statusMessage.createBlock({ type: "agent", name: this.name, task: taskPreview });
    agentBlock.state = "in_progress";

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

            const isSubAgent = tool instanceof Agent;

            // For sub-agents, don't create toolBlock - the sub-agent creates its own agent block
            // For regular tools, create a toolBlock to show progress
            const toolBlock = isSubAgent
              ? null
              : agentBlock.addChild({ type: "tool", name: toolUse.name, input: toolUse.input });
            if (toolBlock) toolBlock.state = "in_progress";

            try {
              if (verbose) {
                const inputStr = JSON.stringify(toolUse.input);
                const inputPreview = inputStr.length > 150 ? `${inputStr.substring(0, 150)}...` : inputStr;
                logger.info(
                  { taskId, toolId: toolLogId, agent: this.name, tool: toolUse.name },
                  `[${taskId}:${toolLogId}] → ${toolUse.name}(${inputPreview})`,
                );
              }

              const result = await tool.execute(toolUse.input as Record<string, unknown>, {
                ...context,
                parentBlock: agentBlock, // Sub-agents use this to nest their block
              });

              // Check for file outputs and send to output
              if (result && typeof result === "object" && "files" in result) {
                const files = (result as { files: FileData[] }).files;
                if (Array.isArray(files) && files.length > 0) {
                  for (const file of files) {
                    if (file.mimeType.startsWith("image/")) context.statusMessage.addPhoto(file);
                    else context.statusMessage.addFile(file);
                  }
                }
              }

              // Update tool block with result (only for regular tools)
              const resultStr = JSON.stringify(result);
              if (toolBlock) {
                toolBlock.content = { type: "tool", name: toolUse.name, input: toolUse.input, result };
                toolBlock.state = "completed";
              }

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

              // Update tool block with error details (only for regular tools)
              if (toolBlock) {
                toolBlock.content = { type: "tool", name: toolUse.name, input: toolUse.input, error: errorMessage };
                toolBlock.state = "error";
              }

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

      // Summarize result and store in block content
      const resultSummary = await summarizer.summarizeTool({ toolName: this.name, input: task, output: result });
      agentBlock.content = { type: "agent", name: this.name, task: taskPreview, result: resultSummary };
      agentBlock.state = "completed";

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

      return {
        success: true,
        result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark agent as error
      agentBlock.state = "error";

      if (verbose) {
        logger.error({ taskId, agent: this.name, error }, `[${taskId}] ✗ ${this.name} failed`);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
