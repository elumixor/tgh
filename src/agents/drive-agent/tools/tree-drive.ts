import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { buildTree, formatTreeAscii } from "services/google-drive/drive-tree";
import { z } from "zod";

export const treeDriveTool: ToolDefinition = {
  name: "tree_drive",
  description:
    "Display Google Drive folder hierarchy as a tree. Shows structure with IDs, names, types. Useful for understanding folder organization before searching or uploading.",
  parameters: z.object({
    folder_id: z.string().optional().describe("Root folder ID. Omit to show all shared folders."),
    depth: z.number().optional().describe("How many levels deep (default: 3, max: 5)"),
    show_files: z.boolean().optional().describe("Include files, not just folders (default: true)"),
    show_ids: z.boolean().optional().describe("Show file/folder IDs (default: true)"),
    show_size: z.boolean().optional().describe("Show file sizes (default: false)"),
  }),
  execute: async ({ folder_id, depth, show_files, show_ids, show_size }) => {
    const maxDepth = Math.min(depth ?? 3, 5);
    const showFiles = show_files ?? true;
    const showIds = show_ids ?? true;
    const showSize = show_size ?? false;

    logger.info({ folderId: folder_id, depth: maxDepth, showFiles }, "Building Drive tree");

    const tree = await buildTree(folder_id, { maxDepth, includeFiles: showFiles });
    const ascii = formatTreeAscii(tree, { showIds, showSize, maxLines: 150 });

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
      tree: ascii,
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
