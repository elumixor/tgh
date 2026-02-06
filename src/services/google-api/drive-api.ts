import type { OAuth2Client } from "google-auth-library";
import type { drive_v3 } from "googleapis";
import { google } from "googleapis";
import { logger } from "logger";
import { DriveFile } from "./drive-file";
import { globToQuery } from "./glob-query";

const DEFAULT_FIELDS = "files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)";
const SINGLE_FIELDS = DEFAULT_FIELDS.replace("files(", "").replace(")", "");
const MAX_PAGE_SIZE = 1000;
const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveApi {
  private readonly client;

  constructor(auth: OAuth2Client) {
    this.client = google.drive({ version: "v3", auth });
    logger.info("Drive API initialized");
  }

  rootFolder(): Promise<DriveFile[]> {
    return this.getSharedRoots(false);
  }

  async tree(rootFolderId?: string, maxDepth = 3, includeFiles = true): Promise<DriveFile[]> {
    maxDepth = Math.min(maxDepth, 10);

    // Get root level
    let rootFiles: DriveFile[];
    if (rootFolderId) {
      const batch = await this.listChildrenBatch([rootFolderId], includeFiles);
      rootFiles = batch.get(rootFolderId) ?? [];
    } else {
      rootFiles = await this.getSharedRoots(!includeFiles);
    }

    const root = sortNodes(rootFiles);

    // BFS: process level by level
    let currentLevel = root.filter((n) => n.isFolder);
    let depth = 1;

    while (currentLevel.length > 0 && depth <= maxDepth) {
      const parentIds = currentLevel.map((n) => n.id);
      const childrenMap = await this.listChildrenBatch(parentIds, includeFiles);

      const nextLevel: DriveFile[] = [];

      for (const parent of currentLevel) {
        const childFiles = childrenMap.get(parent.id) ?? [];
        for (const child of childFiles) child.path = `${parent.path}/${child.name}`;

        const children = sortNodes(childFiles);
        parent.children.push(...children);

        for (const child of children) {
          if (child.isFolder) nextLevel.push(child);
        }
      }

      currentLevel = nextLevel;
      depth++;
    }

    return root;
  }

  async search(pattern: string, maxResults = 100): Promise<DriveFile[]> {
    const { query, filter } = globToQuery(pattern);
    const q = query ? `trashed = false and ${query}` : "trashed = false";
    const files = await this.listFiles(q, maxResults);
    return files.filter((f) => filter(f.name));
  }

  async copy(fileId: string, name: string, parentId?: string): Promise<DriveFile> {
    const { data } = await this.client.files.copy({
      fileId,
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
      },
      supportsAllDrives: true,
      fields: SINGLE_FIELDS,
    });

    if (!data.id) throw new Error("Failed to copy file");

    logger.info({ fileId: data.id, name }, "File copied");
    return new DriveFile(data);
  }

  async upload(name: string, content: Buffer | string, mimeType: string, parentId?: string): Promise<DriveFile> {
    const media = {
      mimeType,
      body: typeof content === "string" ? content : Buffer.from(content),
    };

    const response = await this.client.files.create({
      requestBody: {
        name,
        parents: parentId ? [parentId] : undefined,
      },
      media,
      fields: SINGLE_FIELDS,
    });

    logger.info({ fileId: response.data.id, name }, "File uploaded");
    return new DriveFile(response.data);
  }

  async download(fileId: string): Promise<Buffer> {
    const response = await this.client.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });

    const data = response.data as unknown as ArrayBuffer;
    logger.info({ fileId, size: data.byteLength }, "File downloaded");
    return Buffer.from(data);
  }

  async rename(fileId: string, newName: string): Promise<DriveFile> {
    const response = await this.client.files.update({
      fileId,
      requestBody: { name: newName },
      fields: SINGLE_FIELDS,
    });

    logger.info({ fileId, newName }, "File renamed");
    return new DriveFile(response.data);
  }

  async delete(fileId: string): Promise<void> {
    await this.client.files.delete({ fileId });
    logger.info({ fileId }, "File deleted");
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFile> {
    const response = await this.client.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME,
        parents: parentId ? [parentId] : undefined,
      },
      fields: SINGLE_FIELDS,
    });

    logger.info({ folderId: response.data.id, name }, "Folder created");
    return new DriveFile(response.data);
  }

  list(folderId: string): Promise<DriveFile[]> {
    return this.listFiles(`'${folderId}' in parents and trashed = false`);
  }

  async get(fileId: string): Promise<DriveFile | null> {
    try {
      const response = await this.client.files.get({ fileId, fields: SINGLE_FIELDS });
      return new DriveFile(response.data);
    } catch (error) {
      logger.debug({ fileId, error: error instanceof Error ? error.message : error }, "File not found");
      return null;
    }
  }

  // Internal helpers

  private async listFiles(query: string, maxResults = MAX_PAGE_SIZE): Promise<DriveFile[]> {
    const pageSize = Math.min(maxResults, MAX_PAGE_SIZE);

    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.client.files.list({
        q: query,
        fields: `nextPageToken, ${DEFAULT_FIELDS}`,
        pageSize: Math.min(pageSize, maxResults - files.length),
        orderBy: "folder,name",
        pageToken,
      });

      const pageFiles = response.data.files ?? [];
      files.push(...pageFiles);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && files.length < maxResults);

    return files.map((f) => new DriveFile(f));
  }

  private async listChildrenBatch(parentIds: string[], includeFiles: boolean): Promise<Map<string, DriveFile[]>> {
    const results = new Map<string, DriveFile[]>();
    if (parentIds.length === 0) return results;

    const mimeFilter = includeFiles ? "" : ` and mimeType = '${FOLDER_MIME}'`;

    const promises = parentIds.map(async (parentId) => {
      const files = await this.listFiles(`'${parentId}' in parents and trashed = false${mimeFilter}`);
      return { parentId, files };
    });

    const resolved = await Promise.all(promises);
    for (const { parentId, files } of resolved) results.set(parentId, files);

    return results;
  }

  private getSharedRoots(foldersOnly: boolean): Promise<DriveFile[]> {
    const mimeFilter = foldersOnly ? ` and mimeType = '${FOLDER_MIME}'` : "";
    return this.listFiles(`sharedWithMe = true and trashed = false${mimeFilter}`);
  }
}

function sortNodes(nodes: DriveFile[]): DriveFile[] {
  return nodes.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });
}
