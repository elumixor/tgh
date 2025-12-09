import Perplexity from "@perplexity-ai/perplexity_ai";
import { env } from "env";
import { logger } from "logger";

const perplexityClient = new Perplexity({
  apiKey: env.PERPLEXITY_API_KEY,
});

export async function webSearch(query: string): Promise<string> {
  const response = await perplexityClient.chat.completions.create({
    model: "sonar",
    messages: [{ role: "user", content: query }],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from Perplexity API");

  const answer =
    typeof content === "string" ? content : content.map((chunk) => ("text" in chunk ? chunk.text : "")).join("");
  const citations = response.citations;
  let result = answer;

  if (citations && citations.length > 0) {
    result += "\n\nSources:\n";
    for (const citation of citations) result += `• ${citation}\n`;
  }

  logger.info({ query, answerLength: answer.length, citationCount: citations?.length || 0 }, "Web search completed");
  return result;
}
