import { minimatch } from "minimatch";
import { listFiles } from "./drive-api";
import type { DriveFile } from "./google-drive";
import { formatDriveFile } from "./google-drive";

export interface SearchQuery {
  namePattern?: string;
  mimeType?: string;
  parentId?: string;
  pathPattern?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  fullText?: string;
  regex?: RegExp;
  glob?: string;
  sizeMin?: number;
  sizeMax?: number;
}

export interface SearchResult {
  files: DriveFile[];
  apiCalls: number;
  totalScanned: number;
  filterMatched: number;
  executionTimeMs: number;
}

const MIME_TYPE_MAP: Record<string, string> = {
  folder: "application/vnd.google-apps.folder",
  doc: "application/vnd.google-apps.document",
  sheet: "application/vnd.google-apps.spreadsheet",
  slide: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  image: "image/",
  video: "video/",
  audio: "audio/",
};

/**
 * Parse user query string into SearchQuery
 *
 * Syntax:
 * - Simple: "concept art" -> name contains
 * - Type: "type:folder" or "type:image"
 * - Path: "path:Assets/*" -> local path filter
 * - Modified: "modified:>7d" or "modified:2024-01-01"
 * - Glob: "*.png" or "*.{png,jpg}"
 * - Regex: "/pattern/i"
 * - Size: "size:>1mb" or "size:<100kb"
 * - Fulltext: "fulltext:keyword"
 */
export function parseQuery(input: string): SearchQuery {
  const query: SearchQuery = {};
  const remainingTerms: string[] = [];

  const tokens = tokenize(input);

  for (const token of tokens) {
    // Regex pattern: /pattern/flags
    if (token.startsWith("/") && token.lastIndexOf("/") > 0) {
      const lastSlash = token.lastIndexOf("/");
      const pattern = token.slice(1, lastSlash);
      const flags = token.slice(lastSlash + 1);
      query.regex = new RegExp(pattern, flags);
      continue;
    }

    // Prefixed filters
    if (token.includes(":")) {
      const colonIndex = token.indexOf(":");
      const prefix = token.slice(0, colonIndex).toLowerCase();
      const value = token.slice(colonIndex + 1);

      switch (prefix) {
        case "type":
          query.mimeType = MIME_TYPE_MAP[value.toLowerCase()] ?? value;
          break;
        case "path":
          query.pathPattern = value;
          break;
        case "name":
          query.namePattern = value;
          break;
        case "modified":
          parseModifiedFilter(value, query);
          break;
        case "size":
          parseSizeFilter(value, query);
          break;
        case "fulltext":
          query.fullText = value;
          break;
        case "parent":
        case "folder":
          query.parentId = value;
          break;
        default:
          remainingTerms.push(token);
      }
      continue;
    }

    // Glob pattern (contains * or ?)
    if (token.includes("*") || token.includes("?") || token.includes("{")) {
      query.glob = token;
      continue;
    }

    remainingTerms.push(token);
  }

  // Remaining terms become name search
  if (remainingTerms.length > 0 && !query.namePattern) {
    query.namePattern = remainingTerms.join(" ");
  }

  return query;
}

/**
 * Build Google Drive API query string from SearchQuery
 */
export function buildApiQuery(query: SearchQuery): string {
  const parts: string[] = ["trashed = false"];

  if (query.namePattern) {
    parts.push(`name contains '${escapeQueryValue(query.namePattern)}'`);
  }

  if (query.mimeType) {
    if (query.mimeType.endsWith("/")) {
      parts.push(`mimeType contains '${query.mimeType}'`);
    } else {
      parts.push(`mimeType = '${query.mimeType}'`);
    }
  }

  if (query.parentId) {
    parts.push(`'${query.parentId}' in parents`);
  }

  if (query.fullText) {
    parts.push(`fullText contains '${escapeQueryValue(query.fullText)}'`);
  }

  if (query.modifiedAfter) {
    parts.push(`modifiedTime > '${query.modifiedAfter.toISOString()}'`);
  }

  if (query.modifiedBefore) {
    parts.push(`modifiedTime < '${query.modifiedBefore.toISOString()}'`);
  }

  return parts.join(" and ");
}

/**
 * Execute search with optional local filtering
 */
export async function searchFiles(
  input: string | SearchQuery,
  options?: { maxResults?: number; parentPaths?: Map<string, string> },
): Promise<SearchResult> {
  const startTime = performance.now();
  const query = typeof input === "string" ? parseQuery(input) : input;
  const apiQuery = buildApiQuery(query);
  const maxResults = options?.maxResults ?? 100;

  const result = await listFiles({
    query: apiQuery,
    maxResults: needsLocalFilter(query) ? maxResults * 3 : maxResults, // Fetch more if local filtering needed
  });

  let files = result.files;
  const totalScanned = files.length;

  // Apply local filters
  if (query.regex) {
    const regex = query.regex;
    files = files.filter((f) => regex.test(f.name ?? ""));
  }

  if (query.glob) {
    const glob = query.glob;
    files = files.filter((f) => minimatch(f.name ?? "", glob, { nocase: true }));
  }

  if (query.sizeMin !== undefined) {
    const sizeMin = query.sizeMin;
    files = files.filter((f) => {
      const size = Number.parseInt(f.size ?? "0", 10);
      return size >= sizeMin;
    });
  }

  if (query.sizeMax !== undefined) {
    const sizeMax = query.sizeMax;
    files = files.filter((f) => {
      const size = Number.parseInt(f.size ?? "0", 10);
      return size <= sizeMax;
    });
  }

  // Path filtering requires building paths first
  if (query.pathPattern && options?.parentPaths) {
    const parentPaths = options.parentPaths;
    const pathPattern = query.pathPattern;
    files = files.filter((f) => {
      const parentId = f.parents?.[0];
      const parentPath = parentId ? parentPaths.get(parentId) : "";
      const fullPath = parentPath ? `${parentPath}/${f.name}` : (f.name ?? "");
      return minimatch(fullPath, pathPattern, { nocase: true });
    });
  }

  // Limit results
  files = files.slice(0, maxResults);

  // Format results
  const driveFiles: DriveFile[] = files.map((f) => {
    const parentId = f.parents?.[0];
    const parentPath = parentId && options?.parentPaths ? options.parentPaths.get(parentId) : undefined;
    const path = parentPath ? `/${parentPath}/${f.name}` : `/${f.name}`;
    return formatDriveFile(f, path);
  });

  return {
    files: driveFiles,
    apiCalls: result.apiCalls,
    totalScanned,
    filterMatched: driveFiles.length,
    executionTimeMs: performance.now() - startTime,
  };
}

// Helper functions

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let inRegex = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "/" && !inQuotes && (current === "" || inRegex)) {
      if (!inRegex) {
        inRegex = true;
        current += char;
      } else {
        // Check for flags after closing slash
        current += char;
        while (i + 1 < input.length) {
          const nextChar = input[i + 1];
          if (nextChar && /[gimsuvy]/.test(nextChar)) {
            i++;
            current += input[i] ?? "";
          } else break;
        }
        tokens.push(current);
        current = "";
        inRegex = false;
      }
      continue;
    }

    if (inRegex) {
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === " " && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseModifiedFilter(value: string, query: SearchQuery): void {
  // Relative: >7d, <30d
  const relativeMatch = value.match(/^([<>])(\d+)([dhm])$/);
  if (relativeMatch) {
    const [, op, numStr, unit] = relativeMatch;
    if (!numStr || !unit) return;
    const num = Number.parseInt(numStr, 10);

    let ms = num;
    if (unit === "d") ms *= 24 * 60 * 60 * 1000;
    else if (unit === "h") ms *= 60 * 60 * 1000;
    else if (unit === "m") ms *= 60 * 1000;

    const date = new Date(Date.now() - ms);
    if (op === ">") query.modifiedAfter = date;
    else query.modifiedBefore = date;
    return;
  }

  // Range: 2024-01-01..2024-06-01
  const rangeMatch = value.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    const [, start, end] = rangeMatch;
    if (start) query.modifiedAfter = new Date(start);
    if (end) query.modifiedBefore = new Date(end);
    return;
  }

  // Single date
  const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateMatch) {
    query.modifiedAfter = new Date(value);
    return;
  }
}

function parseSizeFilter(value: string, query: SearchQuery): void {
  const match = value.match(/^([<>])(\d+)(kb|mb|gb)?$/i);
  if (!match) return;

  const [, op, sizeStr, unitRaw] = match;
  if (!op || !sizeStr) return;

  let size = Number.parseInt(sizeStr, 10);
  const unit = (unitRaw ?? "b").toLowerCase();

  if (unit === "kb") size *= 1024;
  else if (unit === "mb") size *= 1024 * 1024;
  else if (unit === "gb") size *= 1024 * 1024 * 1024;

  if (op === ">") query.sizeMin = size;
  else query.sizeMax = size;
}

function needsLocalFilter(query: SearchQuery): boolean {
  return !!(
    query.regex ||
    query.glob ||
    query.pathPattern ||
    query.sizeMin !== undefined ||
    query.sizeMax !== undefined
  );
}

function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}
