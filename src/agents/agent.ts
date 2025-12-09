import { Anthropic } from "@anthropic-ai/sdk";
import { env } from "env";
import type { Context } from "grammy";
import { logger } from "logger";

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
}

export interface Tool {
  definition: Anthropic.Tool;
  execute: (toolInput: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;
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

  async execute(toolInput: Record<string, unknown>, context?: ToolContext): Promise<unknown> {
    const task = toolInput.task as string;
    if (!task) throw new Error("Task is required");

    const response = await this.processTask(task, context);

    if (!response.success) throw new Error(response.error ?? "Agent task failed");

    return { result: response.result };
  }

  async processTask(task: string, context?: ToolContext): Promise<AgentResponse> {
    logger.info({ thinking: this.thinkingBudget !== undefined }, `${this.name} starting task: ${task}`);

    try {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

      // Process initial task
      let response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        tools: this.tools.map((t) => t.definition),
        messages,
        thinking: this.thinkingBudget
          ? {
              type: "enabled",
              budget_tokens: this.thinkingBudget,
            }
          : undefined,
      });

      // Use tools while requested and within iteration limit
      let iterations = 0;
      while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        const toolUses = response.content.filter((b) => b.type === "tool_use");
        if (toolUses.length === 0) break;

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        // Call all requested tools
        for (const toolUse of toolUses) {
          if (toolUse.type !== "tool_use") continue;

          try {
            const tool = this.tools.find((t) => t.definition.name === toolUse.name);
            if (!tool) throw new Error(`Tool ${toolUse.name} not found`);

            logger.info(toolUse.input, `${this.name} calling tool: ${toolUse.name}`);

            const result = await tool.execute(toolUse.input as Record<string, unknown>, context);

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: errorMessage }),
              is_error: true,
            });
          }
        }

        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: this.systemPrompt,
          tools: this.tools.map((t) => t.definition),
          messages,
          thinking: this.thinkingBudget
            ? {
                type: "enabled",
                budget_tokens: this.thinkingBudget,
              }
            : undefined,
        });
      }

      const textBlock = response.content.find((b) => b.type === "text");
      const result = textBlock && textBlock.type === "text" ? textBlock.text : "No response";

      return {
        success: true,
        result,
      };
    } catch (error) {
      logger.error({ agent: this.name, error }, "Agent task failed");

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
