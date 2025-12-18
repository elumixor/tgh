import type { Context } from "grammy";
import { Renderer, type RendererOptions } from "../../core/Renderer";
import type { ElementNode } from "../../core/types";
import { TelegramMessageManager } from "./telegram-message-manager";

export class TelegramRenderer extends Renderer {
  private messageManagers: TelegramMessageManager[] = [];

  constructor(
    private readonly ctx: Context,
    rendererOptions?: RendererOptions,
  ) {
    super(rendererOptions);
  }

  async renderMessages(messageNodes: ElementNode[]): Promise<void> {
    for (const [i, node] of messageNodes.entries()) {
      if (!node) continue;

      if (!this.messageManagers[i]) {
        const replyTo = node.props.repliesTo as number | undefined;
        this.messageManagers[i] = new TelegramMessageManager(this.ctx, replyTo);
      }

      await this.messageManagers[i].update(node);
    }

    for (const manager of this.messageManagers.skip(messageNodes.length)) await manager.deleteMessages();
    this.messageManagers = this.messageManagers.take(messageNodes.length);
  }
}
