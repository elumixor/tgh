import { type Instance, render } from "ink";
import React from "react";
import { MessageView } from "../ink/components";
import type { Block, BlockContent, BlockHandle, FileData, MessageContent, MessageHandle } from "../types";
import { ConsoleBlockHandle } from "./console-block-handle";

export class ConsoleMessageHandle implements MessageHandle {
  private blocks: Block[] = [];
  private inkInstance: Instance | null = null;

  constructor(
    content: MessageContent,
    private readonly verbose: boolean,
  ) {
    if (content.text) {
      this.blocks.push({
        id: "initial",
        state: "completed",
        content: { type: "text", text: content.text },
        children: [],
      });
    }
    if (content.files) {
      for (const file of content.files) {
        this.blocks.push({
          id: Math.random().toString(36).substring(2, 9),
          state: "completed",
          content: { type: "file", data: file },
          children: [],
        });
      }
    }
    this.render();
  }

  append(text: string): void {
    this.blocks.push({
      id: Math.random().toString(36).substring(2, 9),
      state: "completed",
      content: { type: "text", text },
      children: [],
    });
    this.render();
  }

  replaceWith(text: string): void {
    this.blocks = [
      {
        id: "replaced",
        state: "completed",
        content: { type: "text", text },
        children: [],
      },
    ];
    this.render();
  }

  addPhoto(file: FileData): void {
    this.blocks.push({
      id: Math.random().toString(36).substring(2, 9),
      state: "completed",
      content: { type: "file", data: file },
      children: [],
    });
    this.render();
  }

  addFile(file: FileData): void {
    this.addPhoto(file);
  }

  clear(): void {
    this.blocks = [];
    this.inkInstance?.clear();
    this.inkInstance = null;
  }

  createBlock(content: BlockContent): BlockHandle {
    const block: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.blocks.push(block);
    this.render();
    return new ConsoleBlockHandle(block, () => this.render(), this.verbose);
  }

  private render(): void {
    if (this.blocks.length === 0) return;

    const element = React.createElement(MessageView, { blocks: this.blocks, verbose: this.verbose });

    if (this.inkInstance) {
      this.inkInstance.rerender(element);
    } else {
      this.inkInstance = render(element);
    }
  }
}
