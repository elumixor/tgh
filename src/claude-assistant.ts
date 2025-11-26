import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export class ClaudeAssistant {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async processMessage(userMessage: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
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
