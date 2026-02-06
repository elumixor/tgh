import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const replaceDocTextTool = defineTool(
  "ReplaceDocText",
  "Replace text placeholders in a Google Doc. All replacements are done in a single batch update. Use this to personalize documents with user data.",
  z.object({
    document_id: z.string().describe("The ID of the document to update"),
    replacements: z
      .array(
        z.object({
          placeholder: z.string().describe("Text to find, e.g. [NAME]"),
          value: z.string().describe("Replacement value, e.g. John Doe"),
        }),
      )
      .describe("List of placeholder→value replacements to apply in a single batch."),
  }),
  async ({ document_id, replacements }, _context) => {
    const record = Object.fromEntries(replacements.map((r) => [r.placeholder, r.value]));
    await google.docs.replaceText(document_id, record);
    return {
      document_id,
      replacements_made: replacements.length,
    };
  },
);
