import { logger } from "logger";
import type { ReactNode } from "react";
import { FinishRenderProvider, reconciler, type Container, type ElementNode, type OutputNode } from ".";

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
  debounceMs?: number;
}

export interface IRenderer {
  render(element: ReactNode): Promise<void>;
}

export abstract class Renderer implements IRenderer {
  private readonly debounceMs: number;
  private debounceTimer?: Timer;
  private currentRoot?: ElementNode;
  private isCommitting = false;
  private needsCommit = false;

  constructor({ debounceMs = 500 }: RendererOptions = {}) {
    this.debounceMs = debounceMs;
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
      () => {},
      () => {},
      () => {},
      () => {},
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
          }}
        >
          {element}
        </FinishRenderProvider>
      );

      reconciler.updateContainer(wrappedElement, fiberRoot, null, null);
      this.scheduleCommit();
    });
  }

  /** Schedule a debounced commit - batches rapid updates */
  private scheduleCommit(): void {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.doCommit(), this.debounceMs);
  }

  /** Flush any pending commit immediately */
  private async flushCommit(): Promise<void> {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    await this.doCommit();
  }

  /** Execute the actual commit - serializes concurrent calls */
  private async doCommit(): Promise<void> {
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
        await this.doCommit();
      }
    }
  }

  protected abstract renderMessages(messageNodes: ElementNode[]): Promise<void>;
}
