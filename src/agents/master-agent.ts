import Anthropic from "@anthropic-ai/sdk";
import type { Context } from "grammy";
import { env } from "../env";
import { logger } from "../logger";
import type { Tool } from "../tools/types";
import type { ToolContext } from "./types";

const MASTER_SYSTEM_PROMPT = `You are an AI assistant for a Telegram bot. Your job is to understand user messages and use available tools to satisfy their requests.

Available tools include:
- Specialized agents for different domains (images, messages, knowledge, web, utilities, drive)
- Direct tools for specific operations

Guidelines:
- Understand the context of Telegram messages (replied-to messages, mentions, etc.)
- Use agents when tasks require their specialized capabilities
- Use direct tools for simple operations
- Be proactive: search history before asking for IDs or clarification
- "this message" or "that message" usually refers to a replied-to message
- Provide clear, concise responses

Response style:
- Direct and professional
- Focus on answering the user's question
- Include relevant details (message IDs, links, sources)
- No unnecessary pleasantries`;

const MAX_TOOL_ITERATIONS = 10;

export class MasterAgent {
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  private tools: Tool[] = [];

  registerTool(tool: Tool): void {
    this.tools.push(tool);
    logger.info({ tool: tool.definition.name }, "Tool registered");
  }

  async processMessage(userMessage: string, telegramCtx?: Context): Promise<string> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    try {
      const context: ToolContext = { telegramCtx, messageId: undefined };
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

      let response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: MASTER_SYSTEM_PROMPT,
        tools: this.tools.map((t) => t.definition),
        messages,
      });

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
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: MASTER_SYSTEM_PROMPT,
          tools: this.tools.map((t) => t.definition),
          messages,
        });
      }

      const textBlock = response.content.find((b) => b.type === "text");
      const result = textBlock && textBlock.type === "text" ? textBlock.text : "No response";

      logger.info({ toolsUsed, iterations, executionTimeMs: Date.now() - startTime }, "Master agent completed");

      return result;
    } catch (error) {
      logger.error({ error, userMessage }, "Master agent failed");
      throw new Error(`Master agent failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
