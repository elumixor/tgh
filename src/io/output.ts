import type { MessageContent, MessageHandle } from "./types";

export interface Output {
  sendMessage(content: MessageContent): MessageHandle;
}
