import type { drive_v3 } from "googleapis";
import { getSharedRoots, listChildrenBatch } from "./drive-api";

export interface TreeNode {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  size?: number;
  modifiedTime?: string;
  isFolder: boolean;
  children?: TreeNode[];
}

export interface TreeOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  foldersFirst?: boolean;
}

export interface TreeStats {
  totalNodes: number;
  foldersCount: number;
  filesCount: number;
  maxDepthReached: number;
  apiCalls: number;
  executionTimeMs: number;
}

export interface TreeResult {
  root: TreeNode[];
  stats: TreeStats;
  pathMap: Map<string, string>; // id -> path mapping for search
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Build tree from root or specific folder using BFS with parallelized level fetching
 */
export async function buildTree(rootFolderId?: string, options?: TreeOptions): Promise<TreeResult> {
  const startTime = performance.now();
  const maxDepth = Math.min(options?.maxDepth ?? 3, 10);
  const includeFiles = options?.includeFiles ?? true;
  const foldersFirst = options?.foldersFirst ?? true;

  const pathMap = new Map<string, string>();
  let apiCalls = 0;
  let totalNodes = 0;
  let foldersCount = 0;
  let filesCount = 0;
  let maxDepthReached = 0;

  // Get root level
  let rootFiles: drive_v3.Schema$File[];
  if (rootFolderId) {
    const batch = await listChildrenBatch([rootFolderId], { includeFiles });
    rootFiles = batch.get(rootFolderId) ?? [];
    apiCalls++;
  } else {
    const result = await getSharedRoots({ foldersOnly: !includeFiles });
    rootFiles = result.files;
    apiCalls += result.apiCalls;
  }

  // Convert to tree nodes
  const root = sortNodes(
    rootFiles.map((f) => fileToNode(f, "")),
    foldersFirst,
  );
  for (const node of root) {
    pathMap.set(node.id, node.path);
    totalNodes++;
    if (node.isFolder) foldersCount++;
    else filesCount++;
  }

  // BFS: process level by level
  let currentLevel = root.filter((n) => n.isFolder);
  let depth = 1;

  while (currentLevel.length > 0 && depth <= maxDepth) {
    maxDepthReached = depth;

    const parentIds = currentLevel.map((n) => n.id);
    const childrenMap = await listChildrenBatch(parentIds, { includeFiles });
    apiCalls += parentIds.length;

    const nextLevel: TreeNode[] = [];

    for (const parent of currentLevel) {
      const childFiles = childrenMap.get(parent.id) ?? [];
      const children = sortNodes(
        childFiles.map((f) => fileToNode(f, parent.path)),
        foldersFirst,
      );

      parent.children = children;

      for (const child of children) {
        pathMap.set(child.id, child.path);
        totalNodes++;
        if (child.isFolder) {
          foldersCount++;
          nextLevel.push(child);
        } else {
          filesCount++;
        }
      }
    }

    currentLevel = nextLevel;
    depth++;
  }

  return {
    root,
    stats: {
      totalNodes,
      foldersCount,
      filesCount,
      maxDepthReached,
      apiCalls,
      executionTimeMs: performance.now() - startTime,
    },
    pathMap,
  };
}

/**
 * Load immediate children of a folder
 */
export async function loadChildren(parentId: string | null, options?: TreeOptions): Promise<TreeNode[]> {
  const includeFiles = options?.includeFiles ?? true;
  const foldersFirst = options?.foldersFirst ?? true;

  if (!parentId) {
    const result = await getSharedRoots({ foldersOnly: !includeFiles });
    return sortNodes(
      result.files.map((f) => fileToNode(f, "")),
      foldersFirst,
    );
  }

  const batch = await listChildrenBatch([parentId], { includeFiles });
  const files = batch.get(parentId) ?? [];
  // Note: We don't have parent path here, so path will be just the name
  return sortNodes(
    files.map((f) => fileToNode(f, "")),
    foldersFirst,
  );
}

/**
 * Format tree as ASCII art
 */
export function formatTreeAscii(
  tree: TreeResult,
  options?: {
    showIds?: boolean;
    showSize?: boolean;
    showModified?: boolean;
    maxLines?: number;
  },
): string {
  const showIds = options?.showIds ?? true;
  const showSize = options?.showSize ?? false;
  const maxLines = options?.maxLines ?? 200;
  const lines: string[] = [];

  function formatNode(node: TreeNode, prefix: string, isLast: boolean): void {
    if (lines.length >= maxLines) return;

    const connector = isLast ? "\u2514\u2500\u2500 " : "\u251c\u2500\u2500 ";
    let line = prefix + connector + node.name;

    if (node.isFolder) line += "/";

    const meta: string[] = [];
    if (showIds) meta.push(node.id.slice(0, 8));
    if (showSize && node.size) meta.push(formatSize(node.size));
    if (meta.length > 0) line += `  [${meta.join(", ")}]`;

    lines.push(line);

    if (node.children) {
      const childPrefix = prefix + (isLast ? "    " : "\u2502   ");
      for (let i = 0; i < node.children.length; i++) {
        if (lines.length >= maxLines) {
          lines.push(`${childPrefix}... (truncated)`);
          return;
        }
        const child = node.children[i];
        if (child) formatNode(child, childPrefix, i === node.children.length - 1);
      }
    }
  }

  for (let i = 0; i < tree.root.length; i++) {
    if (lines.length >= maxLines) break;
    const rootNode = tree.root[i];
    if (rootNode) formatNode(rootNode, "", i === tree.root.length - 1);
  }

  return lines.join("\n");
}

/**
 * Get path for a file/folder ID from a built tree
 */
export function getPathFromTree(tree: TreeResult, id: string): string | undefined {
  return tree.pathMap.get(id);
}

// Helper functions

function fileToNode(file: drive_v3.Schema$File, parentPath: string): TreeNode {
  const name = file.name ?? "Untitled";
  const path = parentPath ? `${parentPath}/${name}` : name;

  return {
    id: file.id ?? "",
    name,
    mimeType: file.mimeType ?? "",
    path,
    size: file.size ? Number.parseInt(file.size, 10) : undefined,
    modifiedTime: file.modifiedTime ?? undefined,
    isFolder: file.mimeType === FOLDER_MIME,
  };
}

function sortNodes(nodes: TreeNode[], foldersFirst: boolean): TreeNode[] {
  return nodes.sort((a, b) => {
    if (foldersFirst) {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
