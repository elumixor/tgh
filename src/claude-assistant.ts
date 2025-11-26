import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export class ClaudeAssistant {
  private client: Anthropic;
  private botUsername?: string;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  setBotUsername(username: string) {
    this.botUsername = username;
  }

  async processMessage(userMessage: string): Promise<string> {
    const systemPrompt = `You are @${this.botUsername || "bot"}, a Telegram bot assistant.

Response style:
- Short, concise, minimal
- Professional tone
- No extra information
- Direct answers only
- No pleasantries or filler`;

    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      const content = message.content[0];
      if (content && content.type === "text") {
        return content.text;
      }

      throw new Error("Unexpected response type from Claude");
    } catch (error) {
      console.error("Claude API error:", error);
      throw new Error("Failed to process message with Claude API");
    }
  }
}
