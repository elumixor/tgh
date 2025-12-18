import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { env } from "env";
import { logger } from "logger";
import type { DocumentWithEmbedding } from "services/openai/embeddings";
import { embeddingsService } from "services/openai/embeddings";
import { memorySyncService } from "./sync-service";

// Binary format constants
const CACHE_FILE = "./cache/memories.bin";
const VERSION = 2; // Simplified format without separate notionId
const EMBEDDING_DIM = 1536;
const ID_SIZE = 64; // Notion page IDs are 36 chars (UUID format)

export interface Memory {
  id: string; // Notion page ID
  content: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}

interface MemoryCache {
  memories: Memory[];
  lastSync: string;
}

// Simple mutex for concurrent access
let isWriting = false;
const writeQueue: (() => void)[] = [];

function acquireLock(): Promise<void> {
  if (!isWriting) {
    isWriting = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    writeQueue.push(() => {
      isWriting = true;
      resolve();
    });
  });
}

function releaseLock(): void {
  const next = writeQueue.shift();
  if (next) next();
  else isWriting = false;
}

/** Read null-padded string from buffer */
function readString(buffer: Buffer, offset: number, size: number): string {
  const slice = buffer.subarray(offset, offset + size);
  const nullIndex = slice.indexOf(0);
  return slice.subarray(0, nullIndex === -1 ? size : nullIndex).toString("utf-8");
}

/** Write null-padded string to buffer */
function writeString(buffer: Buffer, offset: number, size: number, value: string): void {
  const strBuffer = Buffer.alloc(size, 0);
  strBuffer.write(value, 0, "utf-8");
  strBuffer.copy(buffer, offset);
}

/** Load from binary format v2 */
function loadBinary(): MemoryCache | null {
  if (!existsSync(CACHE_FILE)) return null;

  try {
    const buffer = readFileSync(CACHE_FILE);
    if (buffer.length < 16) return null;

    const version = buffer.readUInt32LE(0);

    // Handle v1 migration
    if (version === 1) {
      logger.info("Migrating from v1 binary format...");
      return migrateFromV1(buffer);
    }

    if (version !== VERSION) {
      logger.warn({ version }, "Unknown memory file version");
      return null;
    }

    const count = buffer.readUInt32LE(4);
    const lastSyncMs = Number(buffer.readBigInt64LE(8));
    const lastSync = new Date(lastSyncMs).toISOString();

    const memories: Memory[] = [];
    let offset = 16; // Header size

    for (let i = 0; i < count; i++) {
      // ID (64 bytes) - Notion page ID
      const id = readString(buffer, offset, ID_SIZE);
      offset += ID_SIZE;

      // Content length + content
      const contentLength = buffer.readUInt32LE(offset);
      offset += 4;
      const content = buffer.subarray(offset, offset + contentLength).toString("utf-8");
      offset += contentLength;

      // Timestamps (8 bytes each, int64 ms)
      const createdAtMs = Number(buffer.readBigInt64LE(offset));
      offset += 8;
      const updatedAtMs = Number(buffer.readBigInt64LE(offset));
      offset += 8;

      // Embedding (1536 x float32 = 6144 bytes)
      const embeddingData = buffer.subarray(offset, offset + EMBEDDING_DIM * 4);
      const alignedBuffer = new ArrayBuffer(EMBEDDING_DIM * 4);
      new Uint8Array(alignedBuffer).set(embeddingData);
      const embedding = Array.from(new Float32Array(alignedBuffer));
      offset += EMBEDDING_DIM * 4;

      memories.push({
        id,
        content,
        embedding,
        createdAt: new Date(createdAtMs).toISOString(),
        updatedAt: new Date(updatedAtMs).toISOString(),
      });
    }

    return { memories, lastSync };
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to load binary memory file");
    return null;
  }
}

/** Migrate from v1 format (had separate notionId field) */
function migrateFromV1(buffer: Buffer): MemoryCache | null {
  try {
    const count = buffer.readUInt32LE(4);
    const lastSyncMs = Number(buffer.readBigInt64LE(8));
    const lastSync = new Date(lastSyncMs).toISOString();

    const memories: Memory[] = [];
    let offset = 16;

    for (let i = 0; i < count; i++) {
      // Old ID (64 bytes) - skip this, use notionId instead
      offset += ID_SIZE;

      // Content length + content
      const contentLength = buffer.readUInt32LE(offset);
      offset += 4;
      const content = buffer.subarray(offset, offset + contentLength).toString("utf-8");
      offset += contentLength;

      // Timestamps
      const createdAtMs = Number(buffer.readBigInt64LE(offset));
      offset += 8;
      const updatedAtMs = Number(buffer.readBigInt64LE(offset));
      offset += 8;

      // Sync status (1 byte) - skip
      offset += 1;

      // Notion ID (64 bytes) - this becomes the new id
      const notionId = readString(buffer, offset, ID_SIZE);
      offset += ID_SIZE;

      // Embedding
      const embeddingData = buffer.subarray(offset, offset + EMBEDDING_DIM * 4);
      const alignedBuffer = new ArrayBuffer(EMBEDDING_DIM * 4);
      new Uint8Array(alignedBuffer).set(embeddingData);
      const embedding = Array.from(new Float32Array(alignedBuffer));
      offset += EMBEDDING_DIM * 4;

      // Only include memories that have a notionId (skip unsynced ones - they'll be recreated)
      if (notionId) {
        memories.push({
          id: notionId,
          content,
          embedding,
          createdAt: new Date(createdAtMs).toISOString(),
          updatedAt: new Date(updatedAtMs).toISOString(),
        });
      }
    }

    const cache: MemoryCache = { memories, lastSync };
    saveBinary(cache);
    logger.info({ memoryCount: memories.length }, "Migration from v1 complete");
    return cache;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to migrate from v1");
    return null;
  }
}

/** Save to binary format v2 */
function saveBinary(cache: MemoryCache): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });

    // Calculate total size
    let totalSize = 16; // Header: version(4) + count(4) + lastSync(8)
    for (const m of cache.memories) {
      totalSize += ID_SIZE; // id (Notion page ID)
      totalSize += 4 + Buffer.byteLength(m.content, "utf-8"); // content length + content
      totalSize += 8 + 8; // timestamps
      totalSize += EMBEDDING_DIM * 4; // embedding
    }

    const buffer = Buffer.alloc(totalSize);
    let offset = 0;

    // Header
    buffer.writeUInt32LE(VERSION, offset);
    offset += 4;
    buffer.writeUInt32LE(cache.memories.length, offset);
    offset += 4;
    buffer.writeBigInt64LE(BigInt(new Date(cache.lastSync).getTime()), offset);
    offset += 8;

    // Memories
    for (const m of cache.memories) {
      // ID (Notion page ID)
      writeString(buffer, offset, ID_SIZE, m.id);
      offset += ID_SIZE;

      // Content
      const contentBytes = Buffer.from(m.content, "utf-8");
      buffer.writeUInt32LE(contentBytes.length, offset);
      offset += 4;
      contentBytes.copy(buffer, offset);
      offset += contentBytes.length;

      // Timestamps
      buffer.writeBigInt64LE(BigInt(new Date(m.createdAt).getTime()), offset);
      offset += 8;
      buffer.writeBigInt64LE(BigInt(new Date(m.updatedAt).getTime()), offset);
      offset += 8;

      // Embedding
      const floatArray = new Float32Array(m.embedding);
      Buffer.from(floatArray.buffer).copy(buffer, offset);
      offset += EMBEDDING_DIM * 4;
    }

    writeFileSync(CACHE_FILE, buffer);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : error }, "Failed to save binary memory file");
  }
}

/** Load memories from file */
function loadFromFile(): MemoryCache {
  const binary = loadBinary();
  if (binary) return binary;
  return { memories: [], lastSync: new Date().toISOString() };
}

// In-memory cache
let memoryCache: MemoryCache | null = null;

function getCache(): MemoryCache {
  if (!memoryCache) memoryCache = loadFromFile();
  return memoryCache;
}

// ============================================================================
// Notion Client
// ============================================================================

const notionClient = new Client({ auth: env.NOTION_API_KEY });
const notionDatabaseId = env.NOTION_DATABASE_ID;

function extractNotionContent(page: PageObjectResponse): string | null {
  const nameProp = page.properties.Name;
  if (nameProp?.type === "title" && nameProp.title.length > 0) {
    return nameProp.title.map((text) => text.plain_text).join("");
  }
  return null;
}

async function createNotionPage(content: string): Promise<string> {
  const response = await notionClient.pages.create({
    parent: { database_id: notionDatabaseId },
    properties: {
      Name: { title: [{ text: { content } }] },
    },
  });
  return response.id;
}

async function updateNotionPage(pageId: string, content: string): Promise<void> {
  await notionClient.pages.update({
    page_id: pageId,
    properties: {
      Name: { title: [{ text: { content } }] },
    },
  });
}

async function archiveNotionPage(pageId: string): Promise<void> {
  await notionClient.pages.update({
    page_id: pageId,
    archived: true,
  });
}

// ============================================================================
// Local Cache Helpers (for optimistic updates)
// ============================================================================

/** Add memory to local cache only (no Notion sync) */
async function addMemoryLocal(content: string, id: string): Promise<void> {
  await acquireLock();
  try {
    const cache = getCache();
    const embedding = await embeddingsService.createEmbedding(content);
    const now = new Date().toISOString();

    cache.memories.push({
      id,
      content,
      embedding,
      createdAt: now,
      updatedAt: now,
    });

    saveBinary(cache);
  } finally {
    releaseLock();
  }
}

/** Update memory in local cache only (no Notion sync) */
async function updateMemoryLocal(id: string, newContent: string): Promise<boolean> {
  await acquireLock();
  try {
    const cache = getCache();
    const index = cache.memories.findIndex((m) => m.id === id);
    const existingMemory = cache.memories[index];
    if (index === -1 || !existingMemory) return false;

    const embedding = await embeddingsService.createEmbedding(newContent);

    cache.memories[index] = {
      ...existingMemory,
      content: newContent,
      embedding,
      updatedAt: new Date().toISOString(),
    };

    saveBinary(cache);
    return true;
  } finally {
    releaseLock();
  }
}

/** Delete memory from local cache only (no Notion sync) */
async function deleteMemoryLocal(id: string): Promise<boolean> {
  await acquireLock();
  try {
    const cache = getCache();
    const index = cache.memories.findIndex((m) => m.id === id);
    if (index === -1) return false;

    cache.memories.splice(index, 1);
    saveBinary(cache);
    return true;
  } finally {
    releaseLock();
  }
}

/** Replace temp ID with real Notion ID in local cache */
export async function replaceTempId(tempId: string, realId: string): Promise<void> {
  await acquireLock();
  try {
    const cache = getCache();
    const memory = cache.memories.find((m) => m.id === tempId);
    if (memory) {
      memory.id = realId;
      saveBinary(cache);
    }
  } finally {
    releaseLock();
  }
}

// ============================================================================
// Notion-Only Operations (for background queue)
// ============================================================================

/** Add to Notion only (called by sync service queue) */
async function addMemoryToNotion(content: string): Promise<string> {
  const id = await createNotionPage(content);
  logger.info({ memoryId: id }, "Memory added to Notion");
  return id;
}

/** Update in Notion only (called by sync service queue) */
async function updateMemoryInNotion(id: string, content: string): Promise<boolean> {
  try {
    await updateNotionPage(id, content);
    logger.info({ memoryId: id }, "Memory updated in Notion");
    return true;
  } catch (error) {
    logger.error({ id, error: error instanceof Error ? error.message : error }, "Failed to update in Notion");
    return false;
  }
}

/** Delete from Notion only (called by sync service queue) */
async function deleteMemoryFromNotion(id: string): Promise<boolean> {
  try {
    await archiveNotionPage(id);
    logger.info({ memoryId: id }, "Memory deleted from Notion");
    return true;
  } catch (error) {
    logger.warn({ id, error: error instanceof Error ? error.message : error }, "Failed to delete from Notion");
    return false;
  }
}

// Register functions with sync service
memorySyncService.registerFunctions({
  sync: syncWithNotionInternal,
  add: addMemoryToNotion,
  update: updateMemoryInNotion,
  delete: deleteMemoryFromNotion,
});

// ============================================================================
// Public API
// ============================================================================

/** Search memories by semantic similarity */
export async function searchMemories(query: string, topK = 5): Promise<(Memory & { similarity: number })[]> {
  const cache = getCache();
  if (cache.memories.length === 0) return [];

  const queryEmbedding = await embeddingsService.createEmbedding(query);

  const documents: DocumentWithEmbedding[] = cache.memories.map((m) => ({
    id: m.id,
    content: m.content,
    embedding: m.embedding,
  }));

  const results = embeddingsService.findMostSimilar(queryEmbedding, documents, topK);

  return results
    .map((result) => {
      const memory = cache.memories.find((m) => m.id === result.id);
      if (!memory) return null;
      return { ...memory, similarity: result.similarity };
    })
    .filter((m): m is Memory & { similarity: number } => m !== null);
}

/** Add a new memory - updates local cache immediately, queues Notion sync */
export async function addMemory(content: string): Promise<string> {
  // Generate temp ID for immediate local use
  const tempId = `temp_${crypto.randomUUID()}`;

  // Update local cache immediately (optimistic)
  await addMemoryLocal(content, tempId);
  logger.info({ memoryId: tempId }, "Memory added locally");

  // Queue Notion sync in background
  memorySyncService.queueAdd(content, tempId);

  return tempId;
}

/** Get a memory by ID */
export function getMemory(id: string): Memory | null {
  const cache = getCache();
  return cache.memories.find((m) => m.id === id) ?? null;
}

/** Update an existing memory - updates local cache immediately, queues Notion sync */
export async function updateMemory(id: string, newContent: string): Promise<boolean> {
  // Update local cache immediately (optimistic)
  const success = await updateMemoryLocal(id, newContent);
  if (!success) return false;

  logger.info({ memoryId: id }, "Memory updated locally");

  // Queue Notion sync in background (skip for temp IDs - they'll be synced when added)
  if (!id.startsWith("temp_")) {
    memorySyncService.queueUpdate(id, newContent);
  }

  return true;
}

/** Delete a memory - updates local cache immediately, queues Notion sync */
export async function deleteMemory(id: string): Promise<boolean> {
  // Delete from local cache immediately (optimistic)
  const success = await deleteMemoryLocal(id);
  if (!success) return false;

  logger.info({ memoryId: id }, "Memory deleted locally");

  // Queue Notion sync in background (skip for temp IDs - they don't exist in Notion yet)
  if (!id.startsWith("temp_")) {
    memorySyncService.queueDelete(id);
  }

  return true;
}

/** Get all memories */
export function getAllMemories(): Memory[] {
  return getCache().memories;
}

/** Internal: Sync local cache with Notion (called by sync service) */
async function syncWithNotionInternal(): Promise<void> {
  logger.info("Syncing memories with Notion...");

  try {
    // Load all memories from Notion
    const notionMemories: Array<{ id: string; content: string; timestamp: string }> = [];
    let cursor: string | undefined;

    do {
      const response = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Notion API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as {
        results: unknown[];
        has_more: boolean;
        next_cursor: string | null;
      };

      for (const result of data.results) {
        if (!result || typeof result !== "object" || !("url" in result)) continue;
        const page = result as PageObjectResponse;
        if (page.archived || page.in_trash) continue;

        const content = extractNotionContent(page);
        if (content) {
          notionMemories.push({ id: page.id, content, timestamp: page.created_time });
        }
      }

      cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
    } while (cursor);

    logger.info({ count: notionMemories.length }, "Loaded memories from Notion");

    // Build local cache from Notion data
    const localCache = getCache();
    const localById = new Map(localCache.memories.map((m) => [m.id, m]));

    const newMemories: Memory[] = [];

    for (const notionMemory of notionMemories) {
      const existing = localById.get(notionMemory.id);

      if (existing) {
        // Update content if changed
        if (existing.content !== notionMemory.content) {
          existing.content = notionMemory.content;
          existing.embedding = await embeddingsService.createEmbedding(notionMemory.content);
          existing.updatedAt = new Date().toISOString();
        }
        newMemories.push(existing);
      } else {
        // Import new memory from Notion
        const embedding = await embeddingsService.createEmbedding(notionMemory.content);
        newMemories.push({
          id: notionMemory.id,
          content: notionMemory.content,
          embedding,
          createdAt: notionMemory.timestamp,
          updatedAt: notionMemory.timestamp,
        });
      }
    }

    localCache.memories = newMemories;
    localCache.lastSync = new Date().toISOString();
    saveBinary(localCache);
    memoryCache = localCache;

    logger.info({ memoryCount: localCache.memories.length }, "Memory sync completed");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : error },
      "Failed to sync with Notion, using local cache",
    );
    throw error; // Re-throw so sync service can handle it
  }
}

/** Trigger background sync with Notion (non-blocking) */
export function syncWithNotion(): void {
  memorySyncService.sync();
}

// Re-export sync service for UI access
export { memorySyncService } from "./sync-service";
