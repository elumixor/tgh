import * as fs from "node:fs";
import * as path from "node:path";
import type { Output } from "./output";
import type { Block, BlockContent, BlockHandle, BlockState, FileData, MessageContent, MessageHandle } from "./types";

class FileBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent;

  constructor(
    private readonly block: Block,
    private readonly logFn: (msg: string) => void,
  ) {
    this._content = block.content;
    this.logFn(`[BLOCK START] ${JSON.stringify(block.content)}`);
  }

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    this.block.state = value;
    this.logFn(`[BLOCK STATE] ${value}`);
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    this.block.content = value;
    this.logFn(`[BLOCK CONTENT] ${JSON.stringify(value)}`);
  }

  addChild(content: BlockContent): BlockHandle {
    const child: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.block.children.push(child);
    return new FileBlockHandle(child, this.logFn);
  }
}

class FileMessageHandle implements MessageHandle {
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

export class FileOutput implements Output {
  constructor(private readonly logFile = "./logs/output.log") {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  sendMessage(content: MessageContent): MessageHandle {
    return new FileMessageHandle(this.logFile, content);
  }
}
