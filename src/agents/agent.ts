import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { logger } from "../logger";
import type { Tool } from "../tools/types";
import type { AgentResponse, ToolContext } from "./types";

const MAX_TOOL_ITERATIONS = 10;

export abstract class Agent implements Tool {
  protected client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  public abstract readonly definition: Anthropic.Tool;

  constructor(
    public readonly name: string,
    public readonly model: string,
    public readonly systemPrompt: string,
    public readonly tools: Tool[],
    public readonly maxTokens: number,
    public readonly thinkingBudget?: number,
  ) {}

  async execute(toolInput: Record<string, unknown>, context?: ToolContext): Promise<unknown> {
    const task = toolInput.task as string;
    if (!task) throw new Error("Task is required");

    const response = await this.processTask(task, context);

    if (!response.success) throw new Error(response.error || "Agent task failed");

    return { result: response.result };
  }

  async processTask(task: string, context?: ToolContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let thinkingUsed = false;

    try {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

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

      const thinkingBlock = response.content.find((b) => b.type === "thinking");
      if (thinkingBlock) thinkingUsed = true;

      let iterations = 0;
      while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        const toolUses = response.content.filter((b) => b.type === "tool_use");
        if (toolUses.length === 0) break;

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          if (toolUse.type !== "tool_use") continue;

          toolsUsed.push(toolUse.name);

          try {
            const tool = this.tools.find((t) => t.definition.name === toolUse.name);
            if (!tool) throw new Error(`Tool ${toolUse.name} not found`);

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
        toolsUsed,
        thinkingUsed,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error({ agent: this.name, error }, "Agent task failed");

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolsUsed,
        thinkingUsed,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}
