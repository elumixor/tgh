import type { Context } from "grammy";
import { env } from "../env";
import { logger } from "../logger";
import { createProgressHandler } from "../progress-handler";
import type { Tool } from "./types";

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
}

export const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description:
      "Search the web for current information using Perplexity AI. Use when user asks questions that require up-to-date information, facts, news, or real-world data not in your knowledge base. Returns comprehensive answers with citations from recent web sources.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or question to ask. Be specific and clear.",
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput, context) => {
    const query = toolInput.query as string;
    logger.info({ query }, "Web search request received");

    if (context?.telegramCtx && context?.messageId) {
      handleWebSearch(query, context.telegramCtx, context.messageId).catch((error) =>
        logger.error({ query, error: error instanceof Error ? error.message : error }, "Web search failed"),
      );
    }

    return "Searching the web...";
  },
};

async function handleWebSearch(query: string, ctx: Context, messageId: number) {
  const progress = createProgressHandler(ctx, messageId);

  try {
    await progress.updateProgress({ text: "🔍 Searching the web..." });

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: query,
          },
        ] satisfies PerplexityMessage[],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as PerplexityResponse;
    const answer = data.choices[0]?.message.content;

    if (!answer) throw new Error("No response from Perplexity API");

    const citations = data.citations;
    let message = `🔍 Web Search Results\n\n${answer}`;

    if (citations && citations.length > 0) {
      message += "\n\nSources:\n";
      for (const citation of citations) message += `• ${citation}\n`;
    }

    await ctx.api.sendMessage(ctx.chat?.id ?? 0, message, {
      message_thread_id: ctx.message?.message_thread_id,
    });

    logger.info({ query, answerLength: answer.length, citationCount: citations?.length || 0 }, "Web search completed");
  } catch (error) {
    logger.error({ query, error: error instanceof Error ? error.message : error }, "Web search failed in handler");
    await progress.showError(`Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
