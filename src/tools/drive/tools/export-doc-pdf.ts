import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const exportDocPdfTool = defineTool(
  "ExportDocPdf",
  "Export a Google Doc as a PDF file. Returns the PDF as a file buffer that will be automatically sent to the user.",
  z.object({
    document_id: z.string().describe("The ID of the document to export"),
    filename: z.string().nullable().describe("Filename for the PDF, or null (defaults to document name)"),
  }),
  async ({ document_id, filename }) => {
    const buffer = await google.docs.exportPdf(document_id);

    return {
      files: [
        {
          buffer,
          mimeType: "application/pdf",
          filename: filename ?? "document.pdf",
        },
      ],
    };
  },
);
