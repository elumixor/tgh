import { EventEmitter } from "@elumixor/event-emitter";

export class DeltaStream {
  readonly started = new EventEmitter<void>();
  readonly delta = new EventEmitter<string>();
  readonly ended = new EventEmitter<void>();
}
