import "@elumixor/extensions";
import { models } from "models";
import { openai } from "services/openai";

async function complete(prompt: string): Promise<string> {
  const response = await openai.responses.create({
    model: models.nano,
    input: prompt.trim(),
  });

  return response.output_text?.trim();
}

export async function summarizeTool(toolName: string, input: unknown, output: unknown): Promise<string> {
  const result = await complete(`
Summarize what this tool call accomplished in under 10 words.
Focus on the specific result, do not include tool name. Be specific about values/data.
In case of error, briefly say that tool has failed with error. Summarize the error if possible.

Tool: ${toolName}
Input: ${JSON.stringify(input)}
Output: ${JSON.stringify(output)}

Good examples: "Added 5+7=12", "Found 3 matching files", "Uploaded report.pdf"
Bad examples: "Tool completed", "Done", "MathAgent (done)"`);

  return result ?? `${toolName} (done)`;
}

export async function summarizeError(error: Error): Promise<string> {
  const result = await complete(`
Error occurred:
Name: ${error.name ?? "Error"}
Message: ${error.message ?? "Unknown error"}
Stack: ${error.stack ?? "No stack trace"}

Convert to friendly message (1-2 sentences). Focus on what went wrong and what user can do.
Examples:
- "The requested file was not found. Please check the name and try again."
- "The AI service is temporarily unavailable. Please wait and retry."`);

  return result ?? "An unexpected error occurred. Please try again.";
}
