import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { parseQuery, searchFiles } from "services/google-drive/drive-search";
import { buildTree } from "services/google-drive/drive-tree";
import { z } from "zod";

export const searchDriveFilesTool: ToolDefinition = {
  name: "search_drive_files",
  description: `Search Google Drive with rich query syntax.

Query syntax:
- Simple: "concept art" (name contains)
- Type: "type:folder", "type:image", "type:pdf"
- Path: "path:Assets/*/textures" (local filter)
- Date: "modified:>7d" or "modified:2024-01-01..2024-06-01"
- Glob: "*.png" or "*.{png,jpg}"
- Regex: "/pattern/i"
- Size: "size:>1mb" or "size:<100kb"
- Fulltext: "fulltext:keyword" (search inside docs)
- Combined: "type:image modified:>30d"

Examples:
- "Iris concept" - files with "Iris concept" in name
- "type:folder Assets" - folders containing "Assets"
- "*.png type:image" - PNG images
- "/helios.*texture/i" - regex match`,
  parameters: z.object({
    query: z.string().describe("Search query with optional filters"),
    folder_id: z.string().optional().describe("Limit search to specific folder ID"),
    max_results: z.number().optional().describe("Maximum results (default: 50, max: 500)"),
    include_paths: z.boolean().optional().describe("Build full paths (slower but more useful). Default: true"),
  }),
  execute: async ({ query: queryStr, folder_id, max_results, include_paths }) => {
    const maxResults = Math.min(max_results ?? 50, 500);
    const includePaths = include_paths ?? true;

    if (folder_id && folder_id.length < 20) {
      return {
        error: `Invalid folder ID "${folder_id}" - appears truncated (${folder_id.length} chars). Google Drive IDs are 28-33 characters. Use get_folder_id with the folder name instead.`,
      };
    }

    logger.info({ query: queryStr, folderId: folder_id, maxResults }, "Searching Drive files");

    const query = parseQuery(queryStr);
    if (folder_id) query.parentId = folder_id;

    let parentPaths: Map<string, string> | undefined;
    if (includePaths || query.pathPattern) {
      const tree = await buildTree(undefined, { maxDepth: 4, includeFiles: false });
      parentPaths = tree.pathMap;
    }

    const result = await searchFiles(query, { maxResults, parentPaths }).catch((error: unknown) => {
      const driveError = error as { code?: number; message?: string };
      if (driveError.code === 404) {
        throw new Error(
          `Google Drive API: Folder "${folder_id}" not found or not accessible. Verify the ID is complete and correct.`,
        );
      }
      throw new Error(`Google Drive API error: ${driveError.message ?? "Unknown error"}`);
    });

    logger.info(
      { query: queryStr, results: result.files.length, apiCalls: result.apiCalls, timeMs: result.executionTimeMs.toFixed(0) },
      "Drive search completed",
    );

    return {
      query: queryStr,
      total_results: result.files.length,
      files: result.files,
      stats: {
        api_calls: result.apiCalls,
        scanned: result.totalScanned,
        matched: result.filterMatched,
        time_ms: Math.round(result.executionTimeMs),
      },
    };
  },
};
