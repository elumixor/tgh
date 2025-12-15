import { Buffer } from "node:buffer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "logger";
import type { DocumentWithEmbedding } from "services/openai/embeddings";
import { embeddingsService } from "services/openai/embeddings";

const CACHE_FILE = "./cache/memories.json";
const EMBEDDINGS_FILE = "./cache/embeddings.bin";
const EMBEDDING_DIM = 1536;
const ID_SIZE = 64; // Max bytes for memory ID (null-padded)
const ENTRY_SIZE = ID_SIZE + EMBEDDING_DIM * 4; // ID + float32 array

export interface LocalMemory {
  id: string;
  content: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
  notionId?: string;
  syncStatus?: "synced" | "pending" | "conflict";
}

// Metadata stored in JSON (without embeddings)
interface LocalMemoryMeta {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  notionId?: string;
  syncStatus?: "synced" | "pending" | "conflict";
}

interface MemoryCache {
  memories: LocalMemory[];
  lastSync: string;
}

interface MetadataFile {
  memories: LocalMemoryMeta[];
  lastSync: string;
}

// Simple mutex for concurrent access
let isWriting = false;
const writeQueue: (() => void)[] = [];

async function acquireLock(): Promise<void> {
  if (!isWriting) {
    isWriting = true;
    return;
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
  if (next) {
    next();
  } else {
    isWriting = false;
  }
}

/**
 * Load embeddings from binary file
 */
function loadEmbeddings(): Map<string, number[]> {
  const embeddings = new Map<string, number[]>();

  if (!existsSync(EMBEDDINGS_FILE)) return embeddings;

  try {
    const buffer = readFileSync(EMBEDDINGS_FILE);
    const count = Math.floor(buffer.length / ENTRY_SIZE);

    for (let i = 0; i < count; i++) {
      const offset = i * ENTRY_SIZE;
      // Read ID (null-terminated string)
      const idBuffer = buffer.subarray(offset, offset + ID_SIZE);
      const nullIndex = idBuffer.indexOf(0);
      const id = idBuffer.subarray(0, nullIndex === -1 ? ID_SIZE : nullIndex).toString("utf-8");

      // Read embedding as Float32Array
      const embeddingBuffer = buffer.subarray(offset + ID_SIZE, offset + ENTRY_SIZE);
      const embedding = Array.from(new Float32Array(embeddingBuffer.buffer, embeddingBuffer.byteOffset, EMBEDDING_DIM));

      embeddings.set(id, embedding);
    }
  } catch (error) {
    logger.warn({ error }, "Failed to load embeddings from binary file");
  }

  return embeddings;
}

/**
 * Save embeddings to binary file
 */
function saveEmbeddings(memories: LocalMemory[]): void {
  try {
    mkdirSync(dirname(EMBEDDINGS_FILE), { recursive: true });

    const buffer = Buffer.alloc(memories.length * ENTRY_SIZE);

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      if (!memory) continue;

      const offset = i * ENTRY_SIZE;

      // Write ID (null-padded)
      const idBuffer = Buffer.alloc(ID_SIZE, 0);
      idBuffer.write(memory.id, 0, "utf-8");
      idBuffer.copy(buffer, offset);

      // Write embedding as Float32Array
      const floatArray = new Float32Array(memory.embedding);
      const embeddingBuffer = Buffer.from(floatArray.buffer);
      embeddingBuffer.copy(buffer, offset + ID_SIZE);
    }

    writeFileSync(EMBEDDINGS_FILE, buffer);
  } catch (error) {
    logger.error({ error }, "Failed to save embeddings to binary file");
  }
}

/**
 * Load memories from local files (metadata JSON + binary embeddings)
 */
function loadFromFile(): MemoryCache {
  try {
    if (!existsSync(CACHE_FILE)) return { memories: [], lastSync: new Date().toISOString() };

    const data = readFileSync(CACHE_FILE, "utf-8");
    const metadata = JSON.parse(data) as MetadataFile;
    const embeddings = loadEmbeddings();

    const memories: LocalMemory[] = metadata.memories.map((meta) => ({
      ...meta,
      embedding: embeddings.get(meta.id) ?? [],
    }));

    return { memories, lastSync: metadata.lastSync };
  } catch (error) {
    logger.warn({ error }, "Failed to load memories from file, starting fresh");
    return { memories: [], lastSync: new Date().toISOString() };
  }
}

/**
 * Save memories to local files (metadata JSON + binary embeddings)
 */
function saveToFile(cache: MemoryCache): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });

    // Save metadata (without embeddings)
    const metadata: MetadataFile = {
      memories: cache.memories.map(({ embedding: _, ...meta }) => meta),
      lastSync: cache.lastSync,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(metadata, null, 2));

    // Save embeddings to binary file
    saveEmbeddings(cache.memories);
  } catch (error) {
    logger.error({ error }, "Failed to save memories to file");
  }
}

// In-memory cache
let memoryCache: MemoryCache | null = null;

function getCache(): MemoryCache {
  if (!memoryCache) {
    memoryCache = loadFromFile();
  }
  return memoryCache;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Search memories by semantic similarity
 */
export async function searchMemories(query: string, topK = 5): Promise<(LocalMemory & { similarity: number })[]> {
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
    .filter((m): m is LocalMemory & { similarity: number } => m !== null);
}

/**
 * Add a new memory
 */
export async function addMemory(content: string): Promise<string> {
  await acquireLock();
  try {
    const cache = getCache();

    const embedding = await embeddingsService.createEmbedding(content);
    const now = new Date().toISOString();

    const memory: LocalMemory = {
      id: generateId(),
      content,
      embedding,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    };

    cache.memories.push(memory);
    saveToFile(cache);

    logger.info({ memoryId: memory.id }, "Memory added locally");

    // Queue background sync to Notion (fire-and-forget)
    queueNotionSync(memory);

    return memory.id;
  } finally {
    releaseLock();
  }
}

/**
 * Get a memory by ID
 */
export function getMemory(id: string): LocalMemory | null {
  const cache = getCache();
  return cache.memories.find((m) => m.id === id) ?? null;
}

/**
 * Update an existing memory
 */
export async function updateMemory(id: string, newContent: string): Promise<boolean> {
  await acquireLock();
  try {
    const cache = getCache();
    const index = cache.memories.findIndex((m) => m.id === id);

    const existingMemory = cache.memories[index];
    if (index === -1 || !existingMemory) return false;

    const embedding = await embeddingsService.createEmbedding(newContent);

    const updatedMemory: LocalMemory = {
      ...existingMemory,
      content: newContent,
      embedding,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
    };
    cache.memories[index] = updatedMemory;

    saveToFile(cache);

    logger.info({ memoryId: id }, "Memory updated locally");

    // Queue background sync
    queueNotionSync(updatedMemory);

    return true;
  } finally {
    releaseLock();
  }
}

/**
 * Delete a memory
 */
export async function deleteMemory(id: string): Promise<boolean> {
  await acquireLock();
  try {
    const cache = getCache();
    const index = cache.memories.findIndex((m) => m.id === id);

    if (index === -1) return false;

    cache.memories.splice(index, 1);
    saveToFile(cache);

    logger.info({ memoryId: id }, "Memory deleted locally");
    return true;
  } finally {
    releaseLock();
  }
}

/**
 * Get all memories
 */
export function getAllMemories(): LocalMemory[] {
  return getCache().memories;
}

// Background sync queue
const syncQueue: LocalMemory[] = [];
let syncRunning = false;

function queueNotionSync(memory: LocalMemory): void {
  syncQueue.push(memory);
  processSyncQueue();
}

async function processSyncQueue(): Promise<void> {
  if (syncRunning || syncQueue.length === 0) return;

  syncRunning = true;

  while (syncQueue.length > 0) {
    const memory = syncQueue.shift();
    if (!memory) continue;

    try {
      // Import dynamically to avoid circular dependencies
      const { memoryStore } = await import("services/notion/memory-store");

      if (memory.notionId) {
        // Update existing
        await memoryStore.updateMemory(memory.notionId, memory.content);
      } else {
        // Create new
        const notionId = await memoryStore.addMemory(memory.content);

        // Update local memory with Notion ID
        await acquireLock();
        try {
          const cache = getCache();
          const index = cache.memories.findIndex((m) => m.id === memory.id);
          const memoryToUpdate = cache.memories[index];
          if (index !== -1 && memoryToUpdate) {
            memoryToUpdate.notionId = notionId;
            memoryToUpdate.syncStatus = "synced";
            saveToFile(cache);
          }
        } finally {
          releaseLock();
        }
      }

      logger.debug({ memoryId: memory.id }, "Memory synced to Notion");
    } catch (error) {
      logger.warn({ memoryId: memory.id, error }, "Failed to sync memory to Notion");
      // Re-queue for retry (with backoff in production)
    }
  }

  syncRunning = false;
}

/**
 * Sync local memories with Notion on startup
 */
export async function syncWithNotion(): Promise<void> {
  logger.info("Syncing local memories with Notion...");

  try {
    const { memoryStore } = await import("services/notion/memory-store");
    const notionMemories = await memoryStore.loadMemories();
    const localCache = getCache();

    // Map Notion memories by ID
    const notionById = new Map(notionMemories.map((m) => [m.id, m]));
    const localByNotionId = new Map(
      localCache.memories
        .filter((m): m is LocalMemory & { notionId: string } => !!m.notionId)
        .map((m) => [m.notionId, m]),
    );

    // Import Notion memories that don't exist locally (generate embeddings locally)
    for (const notionMemory of notionMemories) {
      if (!localByNotionId.has(notionMemory.id)) {
        const embedding = await embeddingsService.createEmbedding(notionMemory.content);
        localCache.memories.push({
          id: generateId(),
          content: notionMemory.content,
          embedding,
          createdAt: notionMemory.timestamp,
          updatedAt: notionMemory.timestamp,
          notionId: notionMemory.id,
          syncStatus: "synced",
        });
      }
    }

    // Update local memories that have newer Notion versions
    for (const localMemory of localCache.memories) {
      if (!localMemory.notionId) continue;

      const notionMemory = notionById.get(localMemory.notionId);
      if (!notionMemory) continue;

      const notionTime = new Date(notionMemory.timestamp).getTime();
      const localTime = new Date(localMemory.updatedAt).getTime();

      if (notionTime > localTime) {
        localMemory.content = notionMemory.content;
        localMemory.embedding = await embeddingsService.createEmbedding(notionMemory.content);
        localMemory.updatedAt = notionMemory.timestamp;
        localMemory.syncStatus = "synced";
      }
    }

    // Push pending local memories to Notion
    for (const localMemory of localCache.memories) {
      if (localMemory.syncStatus === "pending" && !localMemory.notionId) {
        try {
          const notionId = await memoryStore.addMemory(localMemory.content);
          localMemory.notionId = notionId;
          localMemory.syncStatus = "synced";
          logger.debug({ memoryId: localMemory.id, notionId }, "Pushed pending memory to Notion");
        } catch (error) {
          logger.warn({ memoryId: localMemory.id, error }, "Failed to push memory to Notion");
        }
      }
    }

    localCache.lastSync = new Date().toISOString();
    saveToFile(localCache);
    memoryCache = localCache;

    logger.info({ memoryCount: localCache.memories.length }, "Memory sync completed");
  } catch (error) {
    logger.warn({ error }, "Failed to sync with Notion, using local memories only");
  }
}
