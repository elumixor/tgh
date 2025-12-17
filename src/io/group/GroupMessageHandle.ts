import { logger } from "logger";
import type { BlockContent, BlockHandle, FileData, MessageHandle } from "../types";
import { GroupBlockHandle } from "./GroupBlockHandle";

export class GroupMessageHandle implements MessageHandle {
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
