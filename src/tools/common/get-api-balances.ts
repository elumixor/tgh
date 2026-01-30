import type { ToolDefinition } from "@agents";
import { env } from "env";
import { models } from "models";
import { z } from "zod";

interface ServiceBalance {
  service: string;
  status: "success" | "error";
  balance?: string;
  credits?: number;
  usage?: Record<string, unknown>;
  error?: string;
}

async function getMeshyBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.meshy.ai/openapi/v1/balance", {
      headers: { Authorization: `Bearer ${env.MESHY_API_KEY}` },
    });

    if (!response.ok) return { service: "Meshy", status: "error", error: `API error: ${response.status}` };

    const data = (await response.json()) as { balance: number };
    return { service: "Meshy", status: "success", credits: data.balance };
  } catch (error) {
    return { service: "Meshy", status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

async function getOpenAIAgentBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: models.fast, max_tokens: 1, messages: [{ role: "user", content: "test" }] }),
    });

    return {
      service: "OpenAI (Agents)",
      status: "success",
      balance: response.ok ? "API key is valid (no public balance endpoint)" : `API error: ${response.status}`,
    };
  } catch (error) {
    return { service: "OpenAI (Agents)", status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

async function getGeminiBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);

    if (!response.ok) return { service: "Gemini", status: "error", error: `API error: ${response.status}` };

    return { service: "Gemini", status: "success", balance: "API key is valid (no balance endpoint available)" };
  } catch (error) {
    return { service: "Gemini", status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

async function getPerplexityBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return { service: "Perplexity", status: "error", error: `API error: ${response.status} - ${errorText}` };
    }

    return { service: "Perplexity", status: "success", balance: "API key is valid (no balance endpoint available)" };
  } catch (error) {
    return { service: "Perplexity", status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

export const getAPIBalancesTool: ToolDefinition = {
  name: "get_api_balances",
  description: "Get balance and usage information for all configured API services (Meshy, OpenAI, Gemini, Perplexity)",
  parameters: z.object({}),
  execute: async () => {
    const results = await Promise.all([getMeshyBalance(), getOpenAIAgentBalance(), getGeminiBalance(), getPerplexityBalance()]);

    return {
      balances: results,
      summary: results
        .map((r) => {
          if (r.status === "error") return `${r.service}: ❌ ${r.error}`;
          if (r.credits !== undefined) return `${r.service}: ${r.credits} credits`;
          if (r.balance) return `${r.service}: ${r.balance}`;
          if (r.usage) return `${r.service}: ${JSON.stringify(r.usage)}`;
          return `${r.service}: ✅ Available`;
        })
        .join("\n"),
    };
  },
};
