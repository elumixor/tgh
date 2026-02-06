import type { ToolDefinition } from "@agentic/streaming-agent";
import { logger } from "logger";
import { buildTree } from "services/google-drive/drive-tree";
import { z } from "zod";

export const treeDriveTool: ToolDefinition = {
  name: "tree_drive",
  description:
    "Display Google Drive folder hierarchy as a tree. Returns structured JSON with nested folders and files. Useful for understanding folder organization before searching or uploading.",
  parameters: z.object({
    folder_id: z.string().optional().describe("Root folder ID. Omit to show all shared folders."),
    depth: z.number().optional().describe("How many levels deep (default: 3, max: 5)"),
    show_files: z.boolean().optional().describe("Include files, not just folders (default: true)"),
  }),
  execute: async ({ folder_id, depth, show_files }) => {
    const maxDepth = Math.min(depth ?? 3, 5);
    const showFiles = show_files ?? true;

    logger.info({ folderId: folder_id, depth: maxDepth, showFiles }, "Building Drive tree");

    const tree = await buildTree(folder_id, { maxDepth, includeFiles: showFiles });

    logger.info(
      {
        nodes: tree.stats.totalNodes,
        folders: tree.stats.foldersCount,
        files: tree.stats.filesCount,
        apiCalls: tree.stats.apiCalls,
        timeMs: tree.stats.executionTimeMs.toFixed(0),
      },
      "Drive tree built",
    );

    return {
      root: tree.root,
      stats: {
        total_nodes: tree.stats.totalNodes,
        folders: tree.stats.foldersCount,
        files: tree.stats.filesCount,
        depth_reached: tree.stats.maxDepthReached,
        api_calls: tree.stats.apiCalls,
        time_ms: Math.round(tree.stats.executionTimeMs),
      },
    };
  },
};
