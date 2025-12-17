import type { StoredBlock } from "services/job-store";
import type { BlockContent, BlockState } from "../types";

export function blockContentToStoredBlock(content: BlockContent, id: string): StoredBlock {
  const now = new Date().toISOString();
  const base = {
    id,
    state: "in_progress" as BlockState,
    startedAt: now,
    children: [],
  };

  switch (content.type) {
    case "agent":
      return { ...base, type: "agent", name: content.name, task: content.task, summary: content.summary };
    case "tool":
      return {
        ...base,
        type: "tool",
        name: content.name,
        input: content.input,
        output: content.result,
        error: content.error,
        summary: content.summary,
      };
    case "text":
      return { ...base, type: "text", name: "text" };
    case "file":
      return { ...base, type: "file", name: content.data.filename ?? "file" };
    case "error":
      return { ...base, type: "error", name: "error", error: content.message };
  }
}

export function updateStoredBlockFromContent(stored: StoredBlock, content: BlockContent): void {
  switch (content.type) {
    case "agent":
      stored.task = content.task;
      stored.summary = content.summary;
      if ("result" in content) stored.output = content.result;
      break;
    case "tool":
      stored.input = content.input;
      stored.output = content.result;
      stored.error = content.error;
      stored.summary = content.summary;
      break;
    case "error":
      stored.error = content.message;
      break;
  }
}
