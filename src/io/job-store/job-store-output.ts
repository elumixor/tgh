import type { JobStore, StoredJob } from "services/job-store";
import type { Output } from "../output";
import type { MessageContent, MessageHandle } from "../types";
import { JobStoreMessageHandle } from "./job-store-message-handle";
import type { WebSocketNotifier } from "./types";

export class JobStoreOutput implements Output {
  private job: StoredJob;

  constructor(
    private readonly store: JobStore,
    jobId: string,
    task: string,
    private readonly notifier?: WebSocketNotifier,
  ) {
    this.job = store.createJob(jobId, task);
  }

  sendMessage(_content: MessageContent): MessageHandle {
    return new JobStoreMessageHandle(this.job, this.store, this.notifier);
  }

  complete(): void {
    this.store.completeJob(this.job.id, "completed");
    this.notifier?.(this.job.id, { type: "job_complete", blockId: undefined, block: undefined });
  }

  error(): void {
    this.store.completeJob(this.job.id, "error");
    this.notifier?.(this.job.id, { type: "job_complete", blockId: undefined, block: undefined });
  }
}
