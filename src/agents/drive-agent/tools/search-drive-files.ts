import type { Tool } from "agents/agent";
import { logger } from "logger";
import { parseQuery, searchFiles } from "services/google-drive/drive-search";
import { buildTree } from "services/google-drive/drive-tree";

export const searchDriveFilesTool: Tool = {
  definition: {
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
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query with optional filters",
        },
        folder_id: {
          type: "string",
          description: "Limit search to specific folder ID",
        },
        max_results: {
          type: "number",
          description: "Maximum results (default: 50, max: 500)",
        },
        include_paths: {
          type: "boolean",
          description: "Build full paths (slower but more useful). Default: true",
        },
      },
      required: ["query"],
    },
  },
  execute: async (toolInput) => {
    const queryStr = toolInput.query as string;
    const folderId = toolInput.folder_id as string | undefined;
    const maxResults = Math.min((toolInput.max_results as number) ?? 50, 500);
    const includePaths = (toolInput.include_paths as boolean) ?? true;

    logger.info({ query: queryStr, folderId, maxResults }, "Searching Drive files");

    const query = parseQuery(queryStr);
    if (folderId) query.parentId = folderId;

    // Build path map if needed for path filtering or display
    let parentPaths: Map<string, string> | undefined;
    if (includePaths || query.pathPattern) {
      const tree = await buildTree(undefined, { maxDepth: 4, includeFiles: false });
      parentPaths = tree.pathMap;
    }

    const result = await searchFiles(query, { maxResults, parentPaths });

    logger.info(
      {
        query: queryStr,
        results: result.files.length,
        apiCalls: result.apiCalls,
        timeMs: result.executionTimeMs.toFixed(0),
      },
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
