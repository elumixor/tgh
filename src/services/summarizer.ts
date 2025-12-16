import { GoogleGenAI } from "@google/genai";
import { env } from "env";

const SUMMARIZE_PROMPT = `Summarize in 5-10 words. Be concise, focus on action/outcome:

{{input}}`;

class Summarizer {
  private readonly client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  private readonly model = "gemini-2.0-flash-lite";
  private readonly cache = new Map<string, string>();

  async summarize(input: string): Promise<string> {
    // Check cache first
    const cacheKey = input.length > 100 ? input.substring(0, 100) : input;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ text: SUMMARIZE_PROMPT.replace("{{input}}", input) }],
      });

      const summary = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? input;
      this.cache.set(cacheKey, summary);
      return summary;
    } catch {
      // On error, return truncated input
      return input.length > 50 ? `${input.substring(0, 50)}...` : input;
    }
  }
}

export const summarizer = new Summarizer();
