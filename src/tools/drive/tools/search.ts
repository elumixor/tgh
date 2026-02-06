import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const searchDriveTool = defineTool(
  "SearchDrive",
  "Search Google Drive files by glob pattern (e.g. *.pdf, report*, *budget*). Without wildcards, matches exact name.",
  z.object({
    pattern: z.string().describe("Glob pattern to match file names (e.g. *.pdf, report*, *budget*)"),
    max_results: z.number().nullable().describe("Maximum results (default: 50, max: 500)"),
  }),
  async ({ pattern, max_results }) => {
    const files = await google.drive.search(pattern, Math.min(max_results ?? 50, 500));
    return files.map((f) => f.toXML()).join("\n");
  },
);
