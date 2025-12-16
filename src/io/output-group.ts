import { logger } from "logger";
import type { Output } from "./output";
import type { BlockContent, BlockHandle, BlockState, FileData, MessageContent, MessageHandle } from "./types";

class GroupBlockHandle implements BlockHandle {
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

class GroupMessageHandle implements MessageHandle {
  constructor(private readonly handles: MessageHandle[]) {}

  append(text: string): void {
    for (const handle of this.handles) {
      try {
        handle.append(text);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: append failed");
      }
    }
  }

  addPhoto(file: FileData): void {
    for (const handle of this.handles) {
      try {
        handle.addPhoto(file);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: addPhoto failed");
      }
    }
  }

  addFile(file: FileData): void {
    for (const handle of this.handles) {
      try {
        handle.addFile(file);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: addFile failed");
      }
    }
  }

  replaceWith(text: string): void {
    for (const handle of this.handles) {
      try {
        handle.replaceWith(text);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: replaceWith failed");
      }
    }
  }

  clear(): void {
    for (const handle of this.handles) {
      try {
        handle.clear();
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: clear failed");
      }
    }
  }

  createBlock(content: BlockContent): BlockHandle {
    const blockHandles: BlockHandle[] = [];
    for (const handle of this.handles) {
      try {
        blockHandles.push(handle.createBlock(content));
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: createBlock failed");
      }
    }
    return new GroupBlockHandle(blockHandles);
  }
}

export class OutputGroup implements Output {
  constructor(private readonly outputs: Output[]) {}

  sendMessage(content: MessageContent): MessageHandle {
    const handles = this.outputs.map((output) => {
      try {
        return output.sendMessage(content);
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, "OutputGroup: sendMessage failed");
        return new NoopMessageHandle();
      }
    });
    return new GroupMessageHandle(handles);
  }
}

class NoopBlockHandle implements BlockHandle {
  private _state: BlockState = "in_progress";
  private _content: BlockContent = { type: "text", text: "" };

  get state(): BlockState {
    return this._state;
  }

  set state(value: BlockState) {
    this._state = value;
  }

  get content(): BlockContent {
    return this._content;
  }

  set content(value: BlockContent) {
    this._content = value;
  }

  addChild(): BlockHandle {
    return new NoopBlockHandle();
  }
}

class NoopMessageHandle implements MessageHandle {
  append(): void {}
  addPhoto(): void {}
  addFile(): void {}
  replaceWith(): void {}
  clear(): void {}
  createBlock(): BlockHandle {
    return new NoopBlockHandle();
  }
}
