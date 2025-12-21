/**
 * Summarization prompts for different tool execution states
 * Used by the Summarizer component to create concise, user-friendly summaries
 */

/**
 * Prompt for summarizing tool start (when tool receives input)
 * Shows what the tool is about to do
 */
export const TOOL_START_PROMPT = `You are summarizing a tool call that just started.

Tool name: {toolName}
Tool input: {input}

Create a very brief (5-10 words max) present progressive summary showing what the tool is doing.

Examples:
- "SearchDriveTool (searching for Lucy concept art...)"
- "GenerateImageTool (creating fantasy landscape image...)"
- "SearchMemoriesTool (looking up character backstory...)"
- "UploadDriveFileTool (uploading scene_01.png...)"

Output ONLY the summary in the format: "{toolName} (action...)"`;

/**
 * Prompt for summarizing successful tool completion
 * Shows what the tool accomplished
 */
export const TOOL_COMPLETE_PROMPT = `You are summarizing a tool call that completed successfully.

Tool name: {toolName}
Tool input: {input}
Tool output: {output}

Create a very brief (5-15 words max) summary showing the result.

Examples:
- "SearchDriveTool (no files found)"
- "SearchDriveTool (found 3 concept art files)"
- "GenerateImageTool (created image: fantasy_landscape.png)"
- "SearchMemoriesTool (found 2 relevant memories about Lucy)"
- "UploadDriveFileTool (uploaded successfully to /Assets folder)"
- "GetMessageInfoTool (message from User: 'Hello world')"

Focus on the outcome, not the process. Be specific with numbers and names when available.

Output ONLY the summary in the format: "{toolName} (result)"`;

/**
 * Prompt for summarizing tool errors
 * Shows what went wrong
 */
export const TOOL_ERROR_PROMPT = `You are summarizing a tool call that failed with an error.

Tool name: {toolName}
Tool input: {input}
Error message: {error}

Create a very brief (5-15 words max) error summary.

Examples:
- "SearchDriveTool (error: API unreachable)"
- "GenerateImageTool (error: invalid prompt)"
- "UploadDriveFileTool (error: file too large - 50MB limit)"
- "SearchMemoriesTool (error: database connection failed)"

Be concise but include the key reason for failure.

Output ONLY the summary in the format: "{toolName} (error: reason)"`;

/**
 * Replace placeholders in a prompt template
 */
export function fillPromptTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}
