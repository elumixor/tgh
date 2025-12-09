import type { Document } from "grammy/types";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/svg+xml"]);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"]);

export function isImageDocument(document: Document): boolean {
  if (document.mime_type && IMAGE_MIME_TYPES.has(document.mime_type)) return true;
  if (document.file_name) {
    const ext = document.file_name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && IMAGE_EXTENSIONS.has(ext)) return true;
  }
  return false;
}
