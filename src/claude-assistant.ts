import Anthropic from "@anthropic-ai/sdk";
import type { Context } from "grammy";
import { env } from "./env";
import { logger } from "./logger";
import { safeEditMessageTextFromContext } from "./telegram-utils";
import { executeTool, type ToolContext, tools } from "./tools";

export class ClaudeAssistant {
  botName?: string;

  private readonly client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async processMessage(userMessage: string, telegramCtx?: Context): Promise<string> {
    const systemPrompt = `You are @${this.botName || "bot"}, a Telegram bot assistant.

Response style:
- Short, concise, minimal
- Professional tone
- No extra information
- Direct answers only
- No pleasantries or filler`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: userMessage,
      },
    ];

    try {
      let response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      });

      let botReplyMessageId: number | undefined;

      while (response.stop_reason === "tool_use") {
        const toolUse = response.content.find((block) => block.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") break;

        if (!botReplyMessageId && telegramCtx) {
          const textContent = response.content.find((block) => block.type === "text");
          const replyText =
            textContent && textContent.type === "text" ? textContent.text : "Processing your request...";
          const sentMessage = await telegramCtx.reply(replyText, {
            reply_parameters: { message_id: telegramCtx.message?.message_id || 0 },
          });
          botReplyMessageId = sentMessage.message_id;
        }

        const toolContext: ToolContext | undefined =
          telegramCtx && botReplyMessageId ? { telegramCtx, messageId: botReplyMessageId } : undefined;

        const toolResult = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, toolContext);

        messages.push({
          role: "assistant",
          content: response.content,
        });

        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: toolResult,
            },
          ],
        });

        response = await this.client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages,
        });
      }

      if (botReplyMessageId && telegramCtx) {
        const content = response.content.find((block) => block.type === "text");
        if (content && content.type === "text")
          await safeEditMessageTextFromContext(telegramCtx, botReplyMessageId, content.text);
        return "";
      }

      const content = response.content.find((block) => block.type === "text");
      if (content && content.type === "text") {
        return content.text;
      }

      throw new Error("Unexpected response type from Claude");
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Claude API error");
      throw new Error("Failed to process message with Claude API");
    }
  }
}

export const claude = new ClaudeAssistant();
