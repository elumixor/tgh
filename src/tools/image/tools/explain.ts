import { upsertMessageExtra } from "db/message-meta";
import { geminiClient } from "services/gemini/gemini";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const explainTool = defineTool(
  "Explain",
  "Explain images or documents (PDFs, etc.) using Gemini vision. Accepts local file paths (from DownloadAttachment). Optionally saves the explanation to the database if sourceMessageId is provided.",
  z.object({
    files: z.array(z.string()).min(1).describe("Local file paths to analyze (from DownloadAttachment results)"),
    question: z
      .string()
      .nullable()
      .describe("Optional specific question about the content. If null, provides a general explanation."),
    sourceMessageId: z
      .number()
      .nullable()
      .describe("If provided, saves the explanation to the database for this message ID"),
  }),
  async ({ files, question, sourceMessageId }, { currentChatId }) => {
    const task = question ?? "Describe this content in detail. If it's a document, summarize the key points.";
    const { texts } = await geminiClient.analyzeImage(task, files);
    const explanation = texts.join("\n\n");

    if (sourceMessageId) {
      await upsertMessageExtra(currentChatId, sourceMessageId, {
        imageExplanation: explanation,
        imageExplanationDate: new Date().toISOString(),
      });
    }

    return { explanation };
  },
);
