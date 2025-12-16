import type { Message } from "./types";

export abstract class Input {
  protected listeners: Array<(msg: Message) => void> = [];

  on(event: "message", callback: (msg: Message) => void): void {
    if (event === "message") this.listeners.push(callback);
  }

  off(event: "message", callback: (msg: Message) => void): void {
    if (event === "message") this.listeners = this.listeners.filter((l) => l !== callback);
  }

  protected emit(msg: Message): void {
    for (const listener of this.listeners) listener(msg);
  }
}
