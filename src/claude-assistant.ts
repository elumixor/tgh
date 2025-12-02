import Anthropic from "@anthropic-ai/sdk";
import type { Context } from "grammy";
import { env } from "./env";
import { logger } from "./logger";
import { safeEditMessageTextFromContext } from "./telegram-utils";
import { executeTool, type ToolContext, tools } from "./tools";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_MAX_TOKENS = 2048;

interface ToolExecutionLog {
  toolName: string;
  input: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: unknown;
}

const formatError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export class ClaudeAssistant {
  botName?: string;

  private readonly client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  async processMessage(userMessage: string, telegramCtx?: Context): Promise<string> {
    const systemPrompt = `You are @${this.botName || "bot"}, a Telegram bot assistant that responds to chat messages.

Context awareness:
- You operate in Telegram chats (private or group conversations)
- When users refer to "this message" or similar phrases, they typically mean a message they have replied to
- Message replies provide important context for understanding user requests
- When the message includes voice, transcribe it to text and analyze the transcription
- Always try to solve user requests autonomously using the provided tools, like getting message info, searching the message history, before asking for more information

Response style:
- Short, concise, minimal
- Professional tone
- No extra information
- Direct answers only
- No pleasantries or filler`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

    try {
      let response = await this.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
        thinking: {
          type: "enabled",
          budget_tokens: 1024,
        },
      });

      let botReplyMessageId: number | undefined;
      const toolLogs: ToolExecutionLog[] = [];

      const thinkingBlock = response.content.find((block) => block.type === "thinking");

      if (thinkingBlock && "thinking" in thinkingBlock && telegramCtx) {
        const abbreviated = this.abbreviateThinking(thinkingBlock.thinking);
        const sentMessage = await telegramCtx.reply(`💭 ${abbreviated}`, {
          reply_parameters: { message_id: telegramCtx.message?.message_id || 0 },
        });
        botReplyMessageId = sentMessage.message_id;
      }

      while (response.stop_reason === "tool_use") {
        const toolUses = response.content.filter((block) => block.type === "tool_use");
        if (toolUses.length === 0) break;

        if (!botReplyMessageId && telegramCtx) {
          const sentMessage = await telegramCtx.reply("Processing...", {
            reply_parameters: { message_id: telegramCtx.message?.message_id || 0 },
          });
          botReplyMessageId = sentMessage.message_id;
        }

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          if (toolUse.type !== "tool_use") continue;

          const toolLog: ToolExecutionLog = {
            toolName: toolUse.name,
            input: toolUse.input as Record<string, unknown>,
            status: "running",
          };
          toolLogs.push(toolLog);

          if (telegramCtx && botReplyMessageId) {
            await this.updateTempMessage(telegramCtx, botReplyMessageId, toolLogs).catch((error) =>
              logger.debug({ error: formatError(error) }, "Failed to update progress message"),
            );
          }

          const toolContext: ToolContext | undefined =
            telegramCtx && botReplyMessageId ? { telegramCtx, messageId: botReplyMessageId } : undefined;

          try {
            const toolResult = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, toolContext);
            toolLog.status = "completed";
            toolLog.result = toolResult;
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(toolResult),
            });
          } catch (error) {
            toolLog.status = "error";
            toolLog.result = formatError(error);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: toolLog.result }),
              is_error: true,
            });
          }

          if (telegramCtx && botReplyMessageId) {
            await this.updateTempMessage(telegramCtx, botReplyMessageId, toolLogs).catch((error) =>
              logger.debug({ error: formatError(error) }, "Failed to update progress message"),
            );
          }
        }

        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: toolResults,
        });

        response = await this.client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: systemPrompt,
          tools,
          messages,
          thinking: {
            type: "enabled",
            budget_tokens: 1024,
          },
        });
      }

      if (botReplyMessageId && telegramCtx) {
        const content = response.content.find((block) => block.type === "text");
        if (content && content.type === "text")
          await safeEditMessageTextFromContext(telegramCtx, botReplyMessageId, content.text);
        return "";
      }

      const content = response.content.find((block) => block.type === "text");
      if (content && content.type === "text") return content.text;

      throw new Error("Unexpected response type from Claude");
    } catch (error) {
      logger.error({ error: formatError(error) }, "Claude API error");
      throw new Error("Failed to process message with Claude API");
    }
  }

  private async updateTempMessage(ctx: Context, messageId: number, toolLogs: ToolExecutionLog[]): Promise<void> {
    const logText = toolLogs
      .map((log) => {
        const emoji = log.status === "running" ? "⏳" : log.status === "completed" ? "✅" : "❌";
        return `${emoji} ${log.toolName}`;
      })
      .join("\n");

    await safeEditMessageTextFromContext(ctx, messageId, `Processing...\n\n${logText}`);
  }

  private abbreviateThinking(thinking: string): string {
    const lines = thinking.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) return "Analyzing...";

    const firstLine = lines[0]?.trim() ?? "Analyzing...";
    const maxLength = 100;
    if (firstLine.length <= maxLength) return firstLine;
    return `${firstLine.substring(0, maxLength)}...`;
  }
}

export const claude = new ClaudeAssistant();
