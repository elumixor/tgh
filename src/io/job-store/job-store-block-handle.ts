import type { JobStore, StoredBlock, StoredJob } from "services/job-store";
import type { BlockContent, BlockHandle, BlockState } from "../types";
import { blockContentToStoredBlock, updateStoredBlockFromContent } from "./helpers";
import type { WebSocketNotifier } from "./types";

export class JobStoreBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent;

  constructor(
    private readonly storedBlock: StoredBlock,
    private readonly job: StoredJob,
    private readonly store: JobStore,
    private readonly notifier?: WebSocketNotifier,
  ) {
    this._content = { type: "text", text: "" };
  }

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    this.storedBlock.state = value;

    if (value === "completed" || value === "error") {
      this.storedBlock.completedAt = new Date().toISOString();
      this.storedBlock.duration =
        new Date(this.storedBlock.completedAt).getTime() - new Date(this.storedBlock.startedAt).getTime();
    }

    this.save();
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    updateStoredBlockFromContent(this.storedBlock, value);
    this.save();
  }

  addChild(content: BlockContent): BlockHandle {
    const id = Math.random().toString(36).substring(2, 9);
    const childBlock = blockContentToStoredBlock(content, id);
    this.storedBlock.children.push(childBlock);
    this.save();
    return new JobStoreBlockHandle(childBlock, this.job, this.store, this.notifier);
  }

  private save(): void {
    this.store.updateJob(this.job);
    this.notifier?.(this.job.id, { type: "block_update", blockId: this.storedBlock.id, block: this.storedBlock });
  }
}
