import type { EventEmitter } from "@elumixor/frontils";
import type { Context, Message } from "grammy";
import type { ExecutionEvent } from "./events/event-types";

/**
 * Application context passed to tools and agents.
 * Contains all necessary information for tool execution including Telegram context.
 */
export interface AppContext {
  /** Unique identifier for this job/request */
  readonly id: string;

  /** Link to the Braintrust trace */
  readonly link: string;

  /** Telegram bot context (for accessing API, chat info, etc.) */
  readonly telegramContext: Context;

  /** Message ID that triggered this request */
  readonly messageId: number;

  /** Chat ID where the request originated */
  readonly chatId: number;

  /** The user's message text */
  readonly userMessage: string;

  /** Message being replied to (if this is a reply) */
  readonly repliedToMessage?: Message;

  /** Event emitter for tracking agent and tool execution */
  readonly events: EventEmitter<ExecutionEvent>;

  /** Optional progress callback for long-running operations */
  onProgress?: (event: ProgressEvent) => void;

  /** Optional file output callback (automatically called for tools returning files) */
  onFile?: (file: FileData) => void;
}

/**
 * Progress event types for tracking tool execution
 */
export type ProgressEvent =
  | { type: "status"; message: string }
  | { type: "progress"; current: number; total: number }
  | { type: "error"; error: string };

/**
 * File data structure for file outputs
 */
export interface FileData {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}
