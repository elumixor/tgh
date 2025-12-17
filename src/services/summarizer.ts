import { GoogleGenAI } from "@google/genai";
import { env } from "env";
import { logger } from "logger";

export interface SummarizeToolOptions {
  toolName: string;
  input: unknown;
  output: unknown;
}

// Simplified, direct prompts
const TOOL_PROMPT = `The tool {{toolName}} was used with the following input and output:
Input: {{input}}
Output: {{output}}
Provide a concise summary of the tool usage in 10 words or less.
Summary should focus on the result achieved, not the process, not a question to be answered.
Example: "Converted image to grayscale" or "Fetched weather data for NYC"`;

const ERROR_PROMPT = `An error occurred while processing a user request:
Error Name: {{errorName}}
Error Message: {{errorMessage}}
Stack Trace: {{stackTrace}}

Convert this technical error into a friendly, actionable message for the user (1-2 sentences).
Focus on what went wrong and what the user can do about it.
Examples:
- "The requested file or folder was not found. Please check the name and try again."
- "The AI service is temporarily unavailable. Please wait a moment and retry."
- "Failed to access required data. Please try again or contact support if the issue persists."`;

class Summarizer {
  private readonly client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  private readonly model = "gemini-2.0-flash"; // Upgraded from flash-lite

  async summarizeTool(options: SummarizeToolOptions): Promise<string> {
    const { toolName, input, output } = options;
    const inputStr = input ? JSON.stringify(input) : "none";
    const outputStr = output ? JSON.stringify(output) : "none";

    const prompt = TOOL_PROMPT.replace("{{toolName}}", toolName)
      .replace("{{input}}", inputStr)
      .replace("{{output}}", outputStr);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ text: prompt }],
    });

    const summary = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!summary) logger.warn({ prompt }, "Summarizer: Empty summary received");
    return summary || "Processing...";
  }

  async summarizeError(error: Error): Promise<string> {
    const errorName = error.name || "Error";
    const errorMessage = error.message || "Unknown error";
    const stackTrace = error.stack ?? "No stack trace available";

    const prompt = ERROR_PROMPT.replace("{{errorName}}", errorName)
      .replace("{{errorMessage}}", errorMessage)
      .replace("{{stackTrace}}", stackTrace);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ text: prompt }],
    });

    const summary = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return summary || "An unexpected error occurred. Please try again.";
  }
}

export const summarizer = new Summarizer();
