import { env } from "../env";
import type { Tool } from "./types";

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
      headers: {
        Authorization: `Bearer ${env.MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      return {
        service: "Meshy",
        status: "error",
        error: `API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as { balance: number };
    return {
      service: "Meshy",
      status: "success",
      credits: data.balance,
    };
  } catch (error) {
    return {
      service: "Meshy",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getAnthropicBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
    });

    return {
      service: "Anthropic (Claude)",
      status: "success",
      balance: response.ok ? "API key is valid (no public balance endpoint)" : `API error: ${response.status}`,
    };
  } catch (error) {
    return {
      service: "Anthropic (Claude)",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getGeminiBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);

    if (!response.ok) {
      return {
        service: "Gemini",
        status: "error",
        error: `API error: ${response.status}`,
      };
    }

    return {
      service: "Gemini",
      status: "success",
      balance: "API key is valid (no balance endpoint available)",
    };
  } catch (error) {
    return {
      service: "Gemini",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getPerplexityBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        service: "Perplexity",
        status: "error",
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    return {
      service: "Perplexity",
      status: "success",
      balance: "API key is valid (no balance endpoint available)",
    };
  } catch (error) {
    return {
      service: "Perplexity",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getOpenAIBalance(): Promise<ServiceBalance> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      return {
        service: "OpenAI",
        status: "error",
        error: `API error: ${response.status}`,
      };
    }

    return {
      service: "OpenAI",
      status: "success",
      balance: "API key is valid (no public balance endpoint)",
    };
  } catch (error) {
    return {
      service: "OpenAI",
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const getAPIBalancesTool: Tool = {
  definition: {
    name: "get_api_balances",
    description:
      "Get balance and usage information for all configured API services (Meshy, Anthropic/Claude, Gemini, Perplexity, OpenAI)",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  execute: async () => {
    const results = await Promise.all([
      getMeshyBalance(),
      getAnthropicBalance(),
      getGeminiBalance(),
      getPerplexityBalance(),
      getOpenAIBalance(),
    ]);

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
