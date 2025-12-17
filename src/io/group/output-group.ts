import type { Output } from "../output";
import type { MessageContent, MessageHandle } from "../types";
import { GroupMessageHandle } from "./GroupMessageHandle";

export class OutputGroup implements Output {
  constructor(private readonly outputs: Output[]) {}

  sendMessage(content: MessageContent): MessageHandle {
    return new GroupMessageHandle(this.outputs.map((output) => output.sendMessage(content)));
  }
}
