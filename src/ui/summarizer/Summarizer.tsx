import { models } from "models";
import { useEffect, useState } from "react";
import { openai } from "services/openai";
import { fillPromptTemplate, TOOL_COMPLETE_PROMPT, TOOL_ERROR_PROMPT, TOOL_START_PROMPT } from "./prompts";

interface SummarizerProps {
  /** Tool name */
  toolName: string;
  /** Tool input parameters */
  input: Record<string, unknown>;
  /** Tool output (for completed state) */
  output?: unknown;
  /** Error message (for error state) */
  error?: string;
  /** State of the tool execution */
  state: "starting" | "completed" | "error";
}

/**
 * Summarizer component that generates concise, user-friendly tool call summaries
 * Uses GPT-5 Nano for lightweight, fast summarization
 */
export function Summarizer({ toolName, input, output, error, state }: SummarizerProps) {
  const [summary, setSummary] = useState<string>(`${toolName} (...)`);

  useEffect(() => {
    void (async () => {
      try {
        let prompt: string;
        const inputStr = JSON.stringify(input, null, 2);

        if (state === "starting") {
          prompt = fillPromptTemplate(TOOL_START_PROMPT, {
            toolName,
            input: inputStr,
          });
        } else if (state === "error" && error) {
          prompt = fillPromptTemplate(TOOL_ERROR_PROMPT, {
            toolName,
            input: inputStr,
            error,
          });
        } else if (state === "completed") {
          const outputStr = JSON.stringify(output, null, 2);
          prompt = fillPromptTemplate(TOOL_COMPLETE_PROMPT, {
            toolName,
            input: inputStr,
            output: outputStr,
          });
        } else {
          // Fallback
          setSummary(`${toolName} (${state})`);
          return;
        }

        // Use GPT-5 Nano for fast, lightweight summarization
        const response = await openai.chat.completions.create({
          model: models.nano,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
          temperature: 0.3, // Low temperature for consistent, factual summaries
        });

        const generatedSummary = response.choices[0]?.message?.content?.trim() ?? `${toolName} (${state})`;
        setSummary(generatedSummary);
      } catch (error) {
        console.error("Summarization error:", error);
        setSummary(`${toolName} (summarization failed)`);
      }
    })();
  }, [toolName, input, output, error, state]);

  return <i>{summary}</i>;
}
