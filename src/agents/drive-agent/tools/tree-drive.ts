import type { Tool } from "agents/agent";
import { logger } from "logger";
import { buildTree, formatTreeAscii } from "services/google-drive/drive-tree";

export const treeDriveTool: Tool = {
  definition: {
    name: "tree_drive",
    description:
      "Display Google Drive folder hierarchy as a tree. Shows structure with IDs, names, types. Useful for understanding folder organization before searching or uploading.",
    input_schema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description: "Root folder ID. Omit to show all shared folders.",
        },
        depth: {
          type: "number",
          description: "How many levels deep (default: 3, max: 5)",
        },
        show_files: {
          type: "boolean",
          description: "Include files, not just folders (default: true)",
        },
        show_ids: {
          type: "boolean",
          description: "Show file/folder IDs (default: true)",
        },
        show_size: {
          type: "boolean",
          description: "Show file sizes (default: false)",
        },
      },
    },
  },
  execute: async (toolInput) => {
    const folderId = toolInput.folder_id as string | undefined;
    const depth = Math.min((toolInput.depth as number) ?? 3, 5);
    const showFiles = (toolInput.show_files as boolean) ?? true;
    const showIds = (toolInput.show_ids as boolean) ?? true;
    const showSize = (toolInput.show_size as boolean) ?? false;

    logger.info({ folderId, depth, showFiles }, "Building Drive tree");

    const tree = await buildTree(folderId, {
      maxDepth: depth,
      includeFiles: showFiles,
    });

    const ascii = formatTreeAscii(tree, {
      showIds,
      showSize,
      maxLines: 150,
    });

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
