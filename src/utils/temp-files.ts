import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const TEMP_PREFIX = "tgh-";

/**
 * Save buffer to a temp file, return the file path
 */
export async function saveTempFile(data: Buffer, extension: string): Promise<string> {
  const filename = `${TEMP_PREFIX}${randomUUID()}.${extension.replace(/^\./, "")}`;
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

/**
 * Detect MIME type from file extension
 */
export function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".json": "application/json",
    ".txt": "text/plain",
    ".glb": "model/gltf-binary",
    ".fbx": "application/octet-stream",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}
