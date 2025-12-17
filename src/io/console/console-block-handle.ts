import { summarizer } from "services/summarizer";
import type { Block, BlockContent, BlockHandle, BlockState } from "../types";

export class ConsoleBlockHandle implements BlockHandle {
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
    const content = this.block.content;

    if (content.type === "tool") {
      summarizer
        .summarizeTool({
          toolName: content.name,
          input: content.input,
          output: content.result,
        })
        .then((summary) => {
          (content as { summary?: string }).summary = summary;
          this.rerenderFn();
        });
    }
    // TODO: Add summarizeAgent method to Summarizer service
    // else if (content.type === "agent") {
    //   summarizer
    //     .summarizeAgent({
    //       agentName: content.name,
    //       task: content.task ?? "unknown task",
    //       result: content.result,
    //     })
    //     .then((summary) => {
    //       (content as { summary?: string }).summary = summary;
    //       this.rerenderFn();
    //     });
    // }
  }
}
