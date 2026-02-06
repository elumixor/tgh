import { logger } from "logger";
import type { ReactNode } from "react";
import { type Container, type ElementNode, FinishRenderProvider, type OutputNode, reconciler } from ".";

// Finds all io-message nodes in the tree
function findMessageNodes(node: OutputNode): ElementNode[] {
  if (node.type === "TEXT") return [];
  if (node.type === "io-message") return [node];
  return node.children.flatMap(findMessageNodes);
}

// Check if there's renderable content outside of Message components
function hasContentOutsideMessages(node: OutputNode): boolean {
  if (node.type === "TEXT") return node.text.trim().length > 0;
  if (node.type === "io-message") return false; // Message content is fine
  if (node.type === "io-root") return node.children.some(hasContentOutsideMessages);
  // Any other element type outside of Message is content
  return true;
}

export interface RendererOptions {
  /** Preferred name: how often commits are allowed to happen while rendering continuously. */
  throttleMs?: number;
}

export interface IRenderer {
  render(element: ReactNode): Promise<void>;
}

export abstract class Renderer implements IRenderer {
  private readonly throttleMs: number;
  private throttleTimer?: Timer;
  private currentRoot?: ElementNode;
  private isCommitting = false;
  private needsCommit = false;

  constructor({ throttleMs = 800 }: RendererOptions = {}) {
    this.throttleMs = throttleMs;
  }

  render(element: ReactNode): Promise<void> {
    const root: ElementNode = { type: "io-root", props: {}, children: [] };
    this.currentRoot = root;

    const container: Container = {
      root,
      commitUpdate: () => this.scheduleCommit(),
    };

    const fiberRoot = reconciler.createContainer(
      container,
      1,
      null,
      false,
      false,
      "",
      (error) => {
        logger.error("React uncaught error:");
        console.error(error);
      },
      (error) => {
        logger.error("React caught error:");
        console.error(error);
      },
      (error) => {
        logger.warn("React recoverable error:");
        console.error(error);
      },
      () => logger.error("React scheduler error:"),
      null,
    );

    const unmount = () => reconciler.updateContainer(null, fiberRoot, null, null);

    return new Promise<void>((resolve) => {
      const wrappedElement = (
        <FinishRenderProvider
          onFinish={async () => {
            await this.flushCommit();
            this.currentRoot = undefined;
            unmount();
            resolve();
          }}>
          {element}
        </FinishRenderProvider>
      );

      reconciler.updateContainer(wrappedElement, fiberRoot, null, null);
      this.scheduleCommit();
    });
  }

  /** Schedule a commit at a fixed rate (throttleMs). */
  private scheduleCommit(): void {
    if (this.throttleTimer) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = undefined;
      void this.doCommit({ flush: false });
    }, this.throttleMs);
  }

  /** Flush any pending commit immediately */
  private async flushCommit(): Promise<void> {
    clearTimeout(this.throttleTimer);
    this.throttleTimer = undefined;
    await this.doCommit({ flush: true });
  }

  /** Execute the actual commit - serializes concurrent calls */
  private async doCommit({ flush }: { flush: boolean }): Promise<void> {
    if (!this.currentRoot) return;

    if (this.isCommitting) {
      this.needsCommit = true;
      return;
    }

    this.isCommitting = true;
    this.needsCommit = false;

    try {
      const messageNodes = findMessageNodes(this.currentRoot);

      if (messageNodes.length === 0 && hasContentOutsideMessages(this.currentRoot)) {
        logger.warn(
          "Content rendered outside of <Message> components will not be displayed. Wrap your content in <Message>.",
        );
      }

      await this.renderMessages(messageNodes);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Failed to commit messages");
    } finally {
      this.isCommitting = false;

      if (this.needsCommit) {
        this.needsCommit = false;
        if (flush) {
          await this.doCommit({ flush: true });
        } else {
          this.scheduleCommit();
        }
      }
    }
  }

  protected abstract renderMessages(messageNodes: ElementNode[]): Promise<void>;
}
