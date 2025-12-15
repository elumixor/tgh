import { existsSync, readFileSync, statSync } from "node:fs";

const CACHE_FILE = "./cache/memories.json";
const EMBEDDINGS_FILE = "./cache/embeddings.bin";

interface MemoryMeta {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  notionId?: string;
  syncStatus?: string;
}

interface MetadataFile {
  memories: MemoryMeta[];
  lastSync: string;
}

function loadMemories(): MemoryMeta[] {
  if (!existsSync(CACHE_FILE)) return [];

  const data = readFileSync(CACHE_FILE, "utf-8");
  const parsed = JSON.parse(data) as MetadataFile;
  return parsed.memories;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStorageInfo(): { jsonSize: number; binSize: number } {
  const jsonSize = existsSync(CACHE_FILE) ? statSync(CACHE_FILE).size : 0;
  const binSize = existsSync(EMBEDDINGS_FILE) ? statSync(EMBEDDINGS_FILE).size : 0;
  return { jsonSize, binSize };
}

const memories = loadMemories();
const storage = getStorageInfo();

console.log("\n=== Memory Storage ===");
console.log(`Metadata: ${formatBytes(storage.jsonSize)}`);
console.log(`Embeddings: ${formatBytes(storage.binSize)}`);
console.log(`Total: ${formatBytes(storage.jsonSize + storage.binSize)}`);

if (memories.length === 0) {
  console.log("\nNo memories stored.\n");
  process.exit(0);
}

console.log(`\n=== Memories (${memories.length}) ===\n`);

for (let i = 0; i < memories.length; i++) {
  const memory = memories[i];
  if (!memory) continue;

  const date = new Date(memory.createdAt).toLocaleDateString();
  const truncatedContent = memory.content.length > 80 ? `${memory.content.slice(0, 77)}...` : memory.content;
  const notionStatus = memory.notionId ? `Notion: ${memory.notionId}` : "Notion: not synced";

  console.log(`[${i + 1}] ${memory.id} (${date})`);
  console.log(`    "${truncatedContent}"`);
  console.log(`    Status: ${memory.syncStatus ?? "unknown"} | ${notionStatus}\n`);
}
