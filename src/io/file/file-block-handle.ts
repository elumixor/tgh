import type { Block, BlockContent, BlockHandle, BlockState } from "../types";

export class FileBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent;

  constructor(
    private readonly block: Block,
    private readonly logFn: (msg: string) => void,
  ) {
    this._content = block.content;
    this.logFn(`[BLOCK START] ${JSON.stringify(block.content)}`);
  }

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    this.block.state = value;
    this.logFn(`[BLOCK STATE] ${value}`);
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    this.block.content = value;
    this.logFn(`[BLOCK CONTENT] ${JSON.stringify(value)}`);
  }

  addChild(content: BlockContent): BlockHandle {
    const child: Block = {
      id: Math.random().toString(36).substring(2, 9),
      state: "in_progress",
      content,
      children: [],
    };
    this.block.children.push(child);
    return new FileBlockHandle(child, this.logFn);
  }
}
