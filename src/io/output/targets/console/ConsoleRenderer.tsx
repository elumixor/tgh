import { type ElementNode, Renderer, serialize } from "io/output/core";

export class ConsoleRenderer extends Renderer {
  protected override renderMessages(messageNodes: ElementNode[]): Promise<void> {
    console.clear();

    for (const node of messageNodes) {
      const text = serialize(node);
      if (text.trim()) console.log(text);
    }

    return Promise.resolve();
  }
}
