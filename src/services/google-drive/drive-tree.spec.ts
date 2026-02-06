import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { drive_v3 } from "googleapis";
import type { TreeNode, TreeResult } from "./drive-tree";
import { buildTree, getPathFromTree, loadChildren } from "./drive-tree";

const mockGetSharedRoots = mock();
const mockListChildrenBatch = mock();

mock.module("./drive-api", () => ({
  getSharedRoots: mockGetSharedRoots,
  listChildrenBatch: mockListChildrenBatch,
}));

describe("buildTree", () => {
  beforeEach(() => {
    mockGetSharedRoots.mockReset();
    mockListChildrenBatch.mockReset();
  });

  it("should build tree from shared roots", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Projects",
        mimeType: "application/vnd.google-apps.folder",
      },
      {
        id: "file1",
        name: "document.pdf",
        mimeType: "application/pdf",
        size: "1024",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    mockListChildrenBatch.mockResolvedValue(new Map([["folder1", []]]));

    const result = await buildTree(undefined, { maxDepth: 1, includeFiles: true });

    expect(result.root).toHaveLength(2);
    expect(result.root[0]?.name).toBe("Projects");
    expect(result.root[0]?.isFolder).toBe(true);
    expect(result.root[1]?.name).toBe("document.pdf");
    expect(result.root[1]?.isFolder).toBe(false);
    expect(result.stats.totalNodes).toBe(2);
    expect(result.stats.foldersCount).toBe(1);
    expect(result.stats.filesCount).toBe(1);
  });

  it("should build tree with nested folders", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Projects",
        mimeType: "application/vnd.google-apps.folder",
      },
    ];

    const mockChildFiles: drive_v3.Schema$File[] = [
      {
        id: "folder2",
        name: "Subfolder",
        mimeType: "application/vnd.google-apps.folder",
      },
      {
        id: "file1",
        name: "readme.txt",
        mimeType: "text/plain",
        size: "512",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    mockListChildrenBatch
      .mockResolvedValueOnce(new Map([["folder1", mockChildFiles]]))
      .mockResolvedValueOnce(new Map([["folder2", []]]));

    const result = await buildTree(undefined, { maxDepth: 2, includeFiles: true });

    expect(result.root).toHaveLength(1);
    expect(result.root[0]?.children).toHaveLength(2);
    expect(result.root[0]?.children?.[0]?.name).toBe("Subfolder");
    expect(result.root[0]?.children?.[1]?.name).toBe("readme.txt");
    expect(result.stats.totalNodes).toBe(3);
    expect(result.stats.maxDepthReached).toBe(2);
  });

  it("should respect maxDepth limit", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Root",
        mimeType: "application/vnd.google-apps.folder",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    mockListChildrenBatch.mockResolvedValue(new Map([["folder1", []]]));

    const result = await buildTree(undefined, { maxDepth: 1, includeFiles: true });

    expect(result.stats.maxDepthReached).toBe(1);
    expect(mockListChildrenBatch).toHaveBeenCalledTimes(1);
  });

  it("should exclude files when includeFiles is false", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Projects",
        mimeType: "application/vnd.google-apps.folder",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    mockListChildrenBatch.mockResolvedValue(new Map([["folder1", []]]));

    const result = await buildTree(undefined, { maxDepth: 1, includeFiles: false });

    expect(result.root).toHaveLength(1);
    expect(result.stats.filesCount).toBe(0);
  });

  it("should build path map correctly", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Projects",
        mimeType: "application/vnd.google-apps.folder",
      },
    ];

    const mockChildFiles: drive_v3.Schema$File[] = [
      {
        id: "file1",
        name: "doc.pdf",
        mimeType: "application/pdf",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    mockListChildrenBatch.mockResolvedValue(new Map([["folder1", mockChildFiles]]));

    const result = await buildTree(undefined, { maxDepth: 1, includeFiles: true });

    expect(result.pathMap.get("folder1")).toBe("Projects");
    expect(result.pathMap.get("file1")).toBe("Projects/doc.pdf");
  });
});

describe("loadChildren", () => {
  beforeEach(() => {
    mockGetSharedRoots.mockReset();
    mockListChildrenBatch.mockReset();
  });

  it("should load root level when parentId is null", async () => {
    const mockRootFiles: drive_v3.Schema$File[] = [
      {
        id: "folder1",
        name: "Root Folder",
        mimeType: "application/vnd.google-apps.folder",
      },
    ];

    mockGetSharedRoots.mockResolvedValue({
      files: mockRootFiles,
      apiCalls: 1,
    });

    const result = await loadChildren(null, { includeFiles: true });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Root Folder");
  });

  it("should load children of specific folder", async () => {
    const mockChildFiles: drive_v3.Schema$File[] = [
      {
        id: "file1",
        name: "document.txt",
        mimeType: "text/plain",
      },
    ];

    mockListChildrenBatch.mockResolvedValue(new Map([["parent123", mockChildFiles]]));

    const result = await loadChildren("parent123", { includeFiles: true });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("document.txt");
  });
});

describe("getPathFromTree", () => {
  it("should return path for existing node", () => {
    const tree: TreeResult = {
      root: [],
      stats: {
        totalNodes: 0,
        foldersCount: 0,
        filesCount: 0,
        maxDepthReached: 0,
        apiCalls: 0,
        executionTimeMs: 0,
      },
      pathMap: new Map([
        ["id1", "folder1/file.txt"],
        ["id2", "folder2"],
      ]),
    };

    expect(getPathFromTree(tree, "id1")).toBe("folder1/file.txt");
    expect(getPathFromTree(tree, "id2")).toBe("folder2");
  });

  it("should return undefined for non-existing node", () => {
    const tree: TreeResult = {
      root: [],
      stats: {
        totalNodes: 0,
        foldersCount: 0,
        filesCount: 0,
        maxDepthReached: 0,
        apiCalls: 0,
        executionTimeMs: 0,
      },
      pathMap: new Map(),
    };

    expect(getPathFromTree(tree, "nonexistent")).toBeUndefined();
  });
});
