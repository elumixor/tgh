import * as fs from "node:fs";
import type { Block, BlockContent, BlockHandle, FileData, MessageContent, MessageHandle } from "../types";
import { FileBlockHandle } from "./file-block-handle";

export class FileMessageHandle implements MessageHandle {
  private text: string;

  constructor(
    private readonly logFile: string,
    content: MessageContent,
  ) {
    this.text = content.text;
    this.log(`[NEW MESSAGE] ${content.text}`);
    if (content.files) {
      for (const file of content.files) {
        this.log(`  [FILE] ${file.filename ?? "file"} (${file.mimeType})`);
      }
    }
  }

  append(text: string): void {
    this.text += text;
    this.log(`[APPEND] ${text}`);
  }

  addPhoto(file: FileData): void {
    this.log(`[PHOTO] ${file.filename ?? "photo"} (${file.mimeType})`);
  }

  addFile(file: FileData): void {
    this.log(`[FILE] ${file.filename ?? "file"} (${file.mimeType})`);
  }

  replaceWith(text: string): void {
    this.text = text;
    this.log(`[REPLACE] ${text}`);
  }

  clear(): void {
    this.text = "";
    this.log("[CLEAR]");
  }

  createBlock(content: BlockContent): BlockHandle {
    const block: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    return new FileBlockHandle(block, (msg) => this.log(msg));
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} ${message}\n`;
    fs.appendFileSync(this.logFile, line);
  }
}
