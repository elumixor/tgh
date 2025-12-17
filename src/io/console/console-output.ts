import type { Output } from "../output";
import type { MessageContent, MessageHandle } from "../types";
import { ConsoleMessageHandle } from "./console-message-handle";

export class ConsoleOutput implements Output {
  constructor(private readonly verbose = false) {}

  sendMessage(content: MessageContent): MessageHandle {
    return new ConsoleMessageHandle(content, this.verbose);
  }
}
