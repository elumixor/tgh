import { describe, expect, test } from "bun:test";
import type { Document } from "grammy/types";
import { isImageDocument } from "./image-detector";

describe("isImageDocument", () => {
  test("returns true for valid image MIME types", () => {
    const mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/svg+xml"];
    for (const mimeType of mimeTypes) {
      const doc = { mime_type: mimeType, file_id: "test", file_unique_id: "test" } as Document;
      expect(isImageDocument(doc)).toBe(true);
    }
  });

  test("returns false for invalid MIME types", () => {
    const mimeTypes = ["application/pdf", "text/plain", "video/mp4", "audio/mpeg"];
    for (const mimeType of mimeTypes) {
      const doc = { mime_type: mimeType, file_id: "test", file_unique_id: "test" } as Document;
      expect(isImageDocument(doc)).toBe(false);
    }
  });

  test("returns true for valid image extensions", () => {
    const extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"];
    for (const ext of extensions) {
      const doc = { file_name: `test${ext}`, file_id: "test", file_unique_id: "test" } as Document;
      expect(isImageDocument(doc)).toBe(true);
    }
  });

  test("returns false for invalid extensions", () => {
    const extensions = [".pdf", ".txt", ".zip", ".exe", ".mp4"];
    for (const ext of extensions) {
      const doc = { file_name: `test${ext}`, file_id: "test", file_unique_id: "test" } as Document;
      expect(isImageDocument(doc)).toBe(false);
    }
  });

  test("handles case-insensitive extensions", () => {
    const extensions = [".JPG", ".PNG", ".WEBP", ".Gif"];
    for (const ext of extensions) {
      const doc = { file_name: `test${ext}`, file_id: "test", file_unique_id: "test" } as Document;
      expect(isImageDocument(doc)).toBe(true);
    }
  });

  test("falls back to extension when MIME type is missing", () => {
    const doc = { file_name: "photo.jpg", file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(true);
  });

  test("uses MIME type when both MIME type and filename present", () => {
    const doc = {
      mime_type: "image/jpeg",
      file_name: "photo.jpg",
      file_id: "test",
      file_unique_id: "test",
    } as Document;
    expect(isImageDocument(doc)).toBe(true);
  });

  test("falls back to extension when MIME type is invalid", () => {
    const doc = {
      mime_type: "application/pdf",
      file_name: "photo.jpg",
      file_id: "test",
      file_unique_id: "test",
    } as Document;
    expect(isImageDocument(doc)).toBe(true);
  });

  test("handles missing filename with valid MIME type", () => {
    const doc = { mime_type: "image/png", file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(true);
  });

  test("handles missing MIME type with invalid extension", () => {
    const doc = { file_name: "document.pdf", file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(false);
  });

  test("returns false when neither MIME type nor filename present", () => {
    const doc = { file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(false);
  });

  test("handles empty filename", () => {
    const doc = { file_name: "", file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(false);
  });

  test("handles filename without extension", () => {
    const doc = { file_name: "photo", file_id: "test", file_unique_id: "test" } as Document;
    expect(isImageDocument(doc)).toBe(false);
  });
});
