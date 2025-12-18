import type { drive_v3 } from "googleapis";
import { getDriveClient } from "./google-drive";

const DEFAULT_FIELDS = "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)";
const MAX_PAGE_SIZE = 1000;

export interface ListOptions {
  query: string;
  fields?: string;
  pageSize?: number;
  maxResults?: number;
  orderBy?: string;
}

export interface ListResult {
  files: drive_v3.Schema$File[];
  totalFetched: number;
  apiCalls: number;
}

/**
 * List files with automatic pagination up to maxResults
 */
export async function listFiles(options: ListOptions): Promise<ListResult> {
  const drive = getDriveClient();
  const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxResults = options.maxResults ?? Number.POSITIVE_INFINITY;

  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  let apiCalls = 0;

  do {
    const response = await drive.files.list({
      q: options.query,
      fields: `nextPageToken, ${options.fields ?? DEFAULT_FIELDS}`,
      pageSize: Math.min(pageSize, maxResults - files.length),
      orderBy: options.orderBy ?? "folder,name",
      pageToken,
    });
    apiCalls++;

    const pageFiles = response.data.files ?? [];
    files.push(...pageFiles);
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && files.length < maxResults);

  return { files, totalFetched: files.length, apiCalls };
}

/**
 * List children of multiple parent folders in parallel
 */
export async function listChildrenBatch(
  parentIds: string[],
  options?: { fields?: string; includeFiles?: boolean },
): Promise<Map<string, drive_v3.Schema$File[]>> {
  const results = new Map<string, drive_v3.Schema$File[]>();
  if (parentIds.length === 0) return results;

  const mimeFilter = options?.includeFiles === false ? " and mimeType = 'application/vnd.google-apps.folder'" : "";

  const promises = parentIds.map(async (parentId) => {
    const result = await listFiles({
      query: `'${parentId}' in parents and trashed = false${mimeFilter}`,
      fields: options?.fields,
    });
    return { parentId, files: result.files };
  });

  const resolved = await Promise.all(promises);
  for (const { parentId, files } of resolved) {
    results.set(parentId, files);
  }

  return results;
}

/**
 * Get shared root folders (top-level items shared with the service account)
 */
export function getSharedRoots(options?: { foldersOnly?: boolean }): Promise<ListResult> {
  const mimeFilter = options?.foldersOnly ? " and mimeType = 'application/vnd.google-apps.folder'" : "";
  return listFiles({
    query: `sharedWithMe = true and trashed = false${mimeFilter}`,
  });
}
