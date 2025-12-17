import type { StoredBlock } from "services/job-store";

export type WebSocketNotifier = (jobId: string, event: { type: string; blockId?: string; block?: StoredBlock }) => void;
