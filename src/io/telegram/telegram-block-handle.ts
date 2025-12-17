import type { Block, BlockContent, BlockHandle, BlockState } from "io/types";
import { summarizer } from "services/summarizer";

export class TelegramBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content = this.block.content;

  constructor(
    private readonly block: Block,
    private readonly updateFn: () => void,
  ) {}

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    this.block.state = value;
    this.updateFn();
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    this.block.content = value;
    void this.triggerSummarization();
    this.updateFn();
  }

  addChild(content: BlockContent): BlockHandle {
    const child: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.block.children.push(child);
    this.updateFn();
    return new TelegramBlockHandle(child, this.updateFn);
  }

  private async triggerSummarization() {
    const content = this.block.content;

    if (content.type === "tool") {
      const summary = await summarizer.summarizeTool({
        toolName: content.name,
        input: content.input,
        output: content.result,
      });

      (content as { summary?: string }).summary = summary;
      this.updateFn();
    } else if (content.type === "agent") {
      const summary = await summarizer.summarizeTool({
        toolName: content.name,
        input: content.task ?? "unknown task",
        output: content.result,
      });

      (content as { summary?: string }).summary = summary;
      this.updateFn();
    }
  }
}
