import { logger } from "logger";
import type { BlockContent, BlockHandle, BlockState } from "../types";

export class GroupBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent;

  constructor(private readonly handles: BlockHandle[]) {
    this._content = handles[0]?.content ?? { type: "text", text: "" };
  }

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
    for (const handle of this.handles) {
      try {
        handle.state = value;
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: setState failed");
      }
    }
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
    for (const handle of this.handles) {
      try {
        handle.content = value;
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: setContent failed");
      }
    }
  }

  addChild(content: BlockContent): BlockHandle {
    const childHandles: BlockHandle[] = [];
    for (const handle of this.handles) {
      try {
        childHandles.push(handle.addChild(content));
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: addChild failed");
      }
    }
    return new GroupBlockHandle(childHandles);
  }
}
