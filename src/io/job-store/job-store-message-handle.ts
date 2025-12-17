import type { JobStore, StoredJob } from "services/job-store";
import type { BlockContent, BlockHandle, FileData, MessageHandle } from "../types";
import { blockContentToStoredBlock } from "./helpers";
import { JobStoreBlockHandle } from "./job-store-block-handle";
import type { WebSocketNotifier } from "./types";

export class JobStoreMessageHandle implements MessageHandle {
  constructor(
    private readonly job: StoredJob,
    private readonly store: JobStore,
    private readonly notifier?: WebSocketNotifier,
  ) {}

  append(_text: string): void {
    // Text appends are not stored in job store (handled by Telegram/Console output)
  }

  addPhoto(_file: FileData): void {
    // Photos are not stored in job store
  }

  addFile(_file: FileData): void {
    // Files are not stored in job store
  }

  replaceWith(_text: string): void {
    // Text replacements are not stored in job store
  }

  clear(): void {
    // Clear is not applicable to job store
  }

  createBlock(content: BlockContent): BlockHandle {
    const id = Math.random().toString(36).substring(2, 9);
    const storedBlock = blockContentToStoredBlock(content, id);
    this.job.blocks.push(storedBlock);
    this.store.updateJob(this.job);
    this.notifier?.(this.job.id, { type: "block_update", blockId: id, block: storedBlock });
    return new JobStoreBlockHandle(storedBlock, this.job, this.store, this.notifier);
  }
}
