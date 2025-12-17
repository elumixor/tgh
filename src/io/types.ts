export interface FileData {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}

export interface Message {
  text: string;
  files?: FileData[];
  referencesMessage?: Message;
}

export interface MessageContent {
  text: string;
  files?: FileData[];
  replyToMessageId?: number;
}

// Block system for structured progress updates
export type BlockState = "in_progress" | "completed" | "error";

export type BlockContent =
  | { type: "agent"; name: string; task?: string; summary?: string; result?: string }
  | { type: "tool"; name: string; input?: unknown; result?: unknown; error?: string; summary?: string }
  | { type: "text"; text: string }
  | { type: "file"; data: FileData }
  | { type: "error"; message: string };

export interface Block {
  id: string;
  state: BlockState;
  content: BlockContent;
  children: Block[];
}

export interface BlockHandle {
  state: BlockState;
  content: BlockContent;
  addChild(content: BlockContent): BlockHandle;
}

export interface MessageHandle {
  append(text: string): void;
  addPhoto(file: FileData): void;
  addFile(file: FileData): void;
  replaceWith(text: string): void;
  clear(): void;
  createBlock(content: BlockContent): BlockHandle;
}
