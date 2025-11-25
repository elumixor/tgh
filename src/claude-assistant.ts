import { $ } from "bun";

export class ClaudeAssistant {
  async processMessage(userMessage: string): Promise<string> {
    try {
      const result = await $`claude -p ${userMessage}`.text();
      return result.trim();
    } catch (error) {
      console.error("Claude CLI error:", error);
      throw new Error("Failed to process message with Claude CLI");
    }
  }
}
