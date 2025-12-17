import * as fs from "node:fs";
import * as path from "node:path";
import type { Output } from "../output";
import type { MessageContent, MessageHandle } from "../types";
import { FileMessageHandle } from "./file-message-handle";

export class FileOutput implements Output {
  constructor(private readonly logFile = "./logs/output.log") {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  sendMessage(content: MessageContent): MessageHandle {
    return new FileMessageHandle(this.logFile, content);
  }
}
