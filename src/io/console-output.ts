import { type Instance, render } from "ink";
import React from "react";
import { summarizer } from "services/summarizer";
import { MessageView } from "./ink/components";
import type { Output } from "./output";
import type { Block, BlockContent, BlockHandle, BlockState, FileData, MessageContent, MessageHandle } from "./types";

class ConsoleBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent;

  constructor(
    private readonly block: Block,
    private readonly rerenderFn: () => void,
    private readonly verbose: boolean,
  ) {
    this._content = block.content;
  }

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    this.block.state = value;
    this.rerenderFn();
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    this.block.content = value;
    if (!this.verbose) this.triggerSummarization();
    this.rerenderFn();
  }

  addChild(content: BlockContent): BlockHandle {
    const child: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.block.children.push(child);
    this.rerenderFn();
    return new ConsoleBlockHandle(child, this.rerenderFn, this.verbose);
  }

  private triggerSummarization(): void {
    const input = this.getContentForSummary();
    summarizer.summarize(input).then((summary) => {
      if ("summary" in this.block.content) {
        (this.block.content as { summary?: string }).summary = summary;
        this.rerenderFn();
      }
    });
  }

  private getContentForSummary(): string {
    const content = this.block.content;
    switch (content.type) {
      case "agent":
        return `Agent ${content.name} task: ${content.task}`;
      case "tool": {
        const parts: string[] = [`Tool ${content.name}`];
        if (content.input) parts.push(`input: ${JSON.stringify(content.input)}`);
        if (content.result) parts.push(`result: ${JSON.stringify(content.result)}`);
        return parts.join(", ");
      }
      case "text":
        return content.text;
      default:
        return JSON.stringify(content);
    }
  }
}

class ConsoleMessageHandle implements MessageHandle {
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

export class ConsoleOutput implements Output {
  constructor(private readonly verbose = false) {}

  sendMessage(content: MessageContent): MessageHandle {
    return new ConsoleMessageHandle(content, this.verbose);
  }
}
