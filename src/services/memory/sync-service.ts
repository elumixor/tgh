import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "logger";

// Queue file location
const QUEUE_FILE = "./cache/sync-queue.json";
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

export type SyncStatus = "idle" | "syncing" | "error";

export interface SyncState {
  status: SyncStatus;
  pendingOperations: number;
  lastSync?: string;
  error?: string;
}

export interface PendingOperation {
  id: string;
  type: "add" | "update" | "delete";
  memoryId?: string; // For update/delete
  content?: string; // For add/update
  timestamp: string;
  retryCount: number;
}

interface QueueCache {
  operations: PendingOperation[];
  version: number;
}

type StateChangeListener = (state: SyncState) => void;
type MemoriesRefreshCallback = () => void;

class MemorySyncService {
  private state: SyncState = { status: "idle", pendingOperations: 0 };
  private queue: PendingOperation[] = [];
  private listeners = new Set<StateChangeListener>();
  private refreshCallbacks = new Set<MemoriesRefreshCallback>();
  private isProcessing = false;
  private syncFunction: (() => Promise<void>) | null = null;
  private addFunction: ((content: string) => Promise<string>) | null = null;
  private updateFunction: ((id: string, content: string) => Promise<boolean>) | null = null;
  private deleteFunction: ((id: string) => Promise<boolean>) | null = null;

  constructor() {
    this.loadQueue();
    this.updateState();
  }

  // Register the actual sync and CRUD functions from memory-store
  registerFunctions(fns: {
    sync: () => Promise<void>;
    add: (content: string) => Promise<string>;
    update: (id: string, content: string) => Promise<boolean>;
    delete: (id: string) => Promise<boolean>;
  }): void {
    this.syncFunction = fns.sync;
    this.addFunction = fns.add;
    this.updateFunction = fns.update;
    this.deleteFunction = fns.delete;
  }

  // Subscribe to state changes
  onStateChange(callback: StateChangeListener): () => void {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  // Subscribe to memory refresh (called after sync completes)
  onMemoriesRefresh(callback: MemoriesRefreshCallback): () => void {
    this.refreshCallbacks.add(callback);
    return () => this.refreshCallbacks.delete(callback);
  }

  // Get current state
  getState(): SyncState {
    return { ...this.state };
  }

  // Get last sync time
  getLastSync(): string | undefined {
    return this.state.lastSync;
  }

  // Set last sync time (called after successful sync)
  setLastSync(time: string): void {
    this.state.lastSync = time;
    this.notifyListeners();
  }

  // Trigger background sync (non-blocking)
  sync(): void {
    if (this.state.status === "syncing") return;
    if (!this.syncFunction) {
      logger.warn("Sync function not registered");
      return;
    }

    this.state.status = "syncing";
    this.state.error = undefined;
    this.notifyListeners();

    this.syncFunction()
      .then(() => {
        this.state.status = "idle";
        this.state.lastSync = new Date().toISOString();
        this.notifyListeners();
        this.notifyRefreshCallbacks();
        // Process any queued operations after sync
        void this.processQueue();
      })
      .catch((error) => {
        this.state.status = "error";
        this.state.error = error instanceof Error ? error.message : String(error);
        this.notifyListeners();
        logger.error({ error: this.state.error }, "Sync failed");
      });
  }

  // Queue an add operation
  queueAdd(content: string, tempId: string): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.error("Queue overflow - cannot add more operations");
      return;
    }

    this.queue.push({
      id: tempId,
      type: "add",
      content,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });

    this.saveQueue();
    this.updateState();
    void this.processQueue();
  }

  // Queue an update operation
  queueUpdate(memoryId: string, content: string): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.error("Queue overflow - cannot add more operations");
      return;
    }

    // Remove any existing pending operations for this memory
    this.queue = this.queue.filter((op) => op.memoryId !== memoryId && op.id !== memoryId);

    this.queue.push({
      id: crypto.randomUUID(),
      type: "update",
      memoryId,
      content,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });

    this.saveQueue();
    this.updateState();
    void this.processQueue();
  }

  // Queue a delete operation
  queueDelete(memoryId: string): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.error("Queue overflow - cannot add more operations");
      return;
    }

    // Remove any existing pending operations for this memory
    this.queue = this.queue.filter((op) => op.memoryId !== memoryId && op.id !== memoryId);

    this.queue.push({
      id: crypto.randomUUID(),
      type: "delete",
      memoryId,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });

    this.saveQueue();
    this.updateState();
    void this.processQueue();
  }

  // Check if a memory has a pending operation
  hasPendingOperation(memoryId: string): boolean {
    return this.queue.some((op) => op.memoryId === memoryId || op.id === memoryId);
  }

  // Get pending operation type for a memory
  getPendingOperationType(memoryId: string): "add" | "update" | "delete" | null {
    const op = this.queue.find((op) => op.memoryId === memoryId || op.id === memoryId);
    return op?.type ?? null;
  }

  // Process queued operations in background
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    if (this.state.status === "syncing") return; // Wait for sync to complete

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];
      if (!operation) break;

      try {
        await this.processOperation(operation);
        // Success - remove from queue
        this.queue.shift();
        this.saveQueue();
        this.updateState();
        this.notifyRefreshCallbacks();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn({ operation: operation.type, error: errorMsg }, "Operation failed, will retry");

        operation.retryCount++;
        if (operation.retryCount >= MAX_RETRIES) {
          logger.error({ operation: operation.type, id: operation.id }, "Operation failed after max retries");
          this.queue.shift(); // Remove failed operation
          this.saveQueue();
          this.updateState();
        } else {
          // Wait before retry with exponential backoff
          const delay = RETRY_DELAYS[operation.retryCount - 1] ?? 4000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.isProcessing = false;
  }

  private async processOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case "add":
        if (!this.addFunction || !operation.content) {
          throw new Error("Add function not registered or content missing");
        }
        await this.addFunction(operation.content);
        break;

      case "update": {
        if (!this.updateFunction || !operation.memoryId || !operation.content) {
          throw new Error("Update function not registered or params missing");
        }
        const updateResult = await this.updateFunction(operation.memoryId, operation.content);
        if (!updateResult) throw new Error("Update failed");
        break;
      }

      case "delete": {
        if (!this.deleteFunction || !operation.memoryId) {
          throw new Error("Delete function not registered or memoryId missing");
        }
        const deleteResult = await this.deleteFunction(operation.memoryId);
        if (!deleteResult) throw new Error("Delete failed");
        break;
      }
    }
  }

  private updateState(): void {
    this.state.pendingOperations = this.queue.length;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const stateCopy = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(stateCopy);
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : error }, "Error in state change listener");
      }
    }
  }

  private notifyRefreshCallbacks(): void {
    for (const callback of this.refreshCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.warn({ error: error instanceof Error ? error.message : error }, "Error in refresh callback");
      }
    }
  }

  private loadQueue(): void {
    try {
      if (!existsSync(QUEUE_FILE)) {
        this.queue = [];
        return;
      }

      const data = readFileSync(QUEUE_FILE, "utf-8");
      const cache: QueueCache = JSON.parse(data);
      this.queue = cache.operations ?? [];
      logger.info({ pendingOperations: this.queue.length }, "Loaded sync queue from file");
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : error }, "Failed to load sync queue");
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      mkdirSync(dirname(QUEUE_FILE), { recursive: true });
      const cache: QueueCache = { operations: this.queue, version: 1 };
      writeFileSync(QUEUE_FILE, JSON.stringify(cache, null, 2));
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Failed to save sync queue");
    }
  }
}

// Singleton instance
export const memorySyncService = new MemorySyncService();
