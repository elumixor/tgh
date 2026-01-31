import "@elumixor/extensions";
import { models } from "models";
import { openai } from "services/openai";

class Summarizer {
  private static readonly TOOL_PROMPT = `Summarize what this tool call accomplished in under 10 words.
Focus on the RESULT, not the tool name. Be specific about values/data.

Tool: {toolName}
Input: {input}
Output: {output}

Good examples: "Added 5+7=12", "Found 3 matching files", "Uploaded report.pdf"
Bad examples: "Tool completed", "Done", "MathAgent (done)"`;

  private static readonly TOOL_ERROR_PROMPT = `Tool {toolName} failed.
Input: {input}
Error: {error}
Create brief (5-15 words) error summary.
Examples: "SearchDriveTool (error: API unreachable)", "GenerateImageTool (error: invalid prompt)"
Output ONLY: "{toolName} (error: reason)"`;

  private static readonly ERROR_PROMPT = `Error occurred:
Name: {errorName}
Message: {errorMessage}
Stack: {stackTrace}

Convert to friendly message (1-2 sentences). Focus on what went wrong and what user can do.
Examples:
- "The requested file was not found. Please check the name and try again."
- "The AI service is temporarily unavailable. Please wait and retry."`;

  private static readonly WORKFLOW_PROMPT = `Give a short name (up to 3 words) summarizing:
{userRequest}`;

  private async complete(prompt: string): Promise<string> {
    const response = await openai.responses.create({
      model: models.nano,
      input: prompt,
    });
    return response.output_text?.trim() ?? "";
  }

  async summarizeTool(toolName: string, input: unknown, output: unknown): Promise<string> {
    const prompt = Summarizer.TOOL_PROMPT.format({
      toolName,
      input: JSON.stringify(input),
      output: JSON.stringify(output),
    });
    return (await this.complete(prompt)) || `${toolName} (done)`;
  }

  async summarizeToolError(toolName: string, input: unknown, error: string): Promise<string> {
    const prompt = Summarizer.TOOL_ERROR_PROMPT.format({
      toolName,
      input: JSON.stringify(input),
      error,
    });
    return (await this.complete(prompt)) ?? `${toolName} (error)`;
  }

  async summarizeError(error: Error): Promise<string> {
    const prompt = Summarizer.ERROR_PROMPT.format({
      errorName: error.name ?? "Error",
      errorMessage: error.message ?? "Unknown error",
      stackTrace: error.stack ?? "No stack trace",
    });
    return (await this.complete(prompt)) ?? "An unexpected error occurred. Please try again.";
  }

  async summarizeWorkflow(userRequest: string): Promise<string> {
    const prompt = Summarizer.WORKFLOW_PROMPT.format({ userRequest });
    const response = await openai.responses.create({
      model: models.nano,
      input: prompt,
    });
    return response.output_text;
  }
}

export const summarizer = new Summarizer();
