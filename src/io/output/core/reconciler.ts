import { createContext } from "react";
import Reconciler, { type ReactContext } from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants";
import type { Container, ElementNode, ElementType, OutputNode, TextNode } from "./types";

type Props = Record<string, unknown>;

function appendChild(parent: ElementNode, child: OutputNode): void {
  child.parent = parent;
  parent.children.push(child);
}

function removeChild(parent: ElementNode, child: OutputNode): void {
  const index = parent.children.indexOf(child);
  if (index !== -1) {
    parent.children.splice(index, 1);
    child.parent = undefined;
  }
}

function insertBefore(parent: ElementNode, child: OutputNode, before: OutputNode): void {
  child.parent = parent;
  const index = parent.children.indexOf(before);
  if (index !== -1) parent.children.splice(index, 0, child);
  else parent.children.push(child);
}

let currentUpdatePriority: Reconciler.EventPriority = DefaultEventPriority;

export const reconciler = Reconciler({
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,

  createInstance(type: ElementType, props: Props): ElementNode {
    return { type, props, children: [] };
  },

  createTextInstance(text: string): TextNode {
    return { type: "TEXT", text };
  },

  appendInitialChild(parentInstance: ElementNode, child: OutputNode): void {
    appendChild(parentInstance, child);
  },

  finalizeInitialChildren(): boolean {
    return false;
  },

  appendChild(parentInstance: ElementNode, child: OutputNode): void {
    appendChild(parentInstance, child);
  },

  appendChildToContainer(container: Container, child: OutputNode): void {
    appendChild(container.root, child);
  },

  removeChild(parentInstance: ElementNode, child: OutputNode): void {
    removeChild(parentInstance, child);
  },

  removeChildFromContainer(container: Container, child: OutputNode): void {
    removeChild(container.root, child);
  },

  insertBefore(parentInstance: ElementNode, child: OutputNode, beforeChild: OutputNode): void {
    insertBefore(parentInstance, child, beforeChild);
  },

  insertInContainerBefore(container: Container, child: OutputNode, beforeChild: OutputNode): void {
    insertBefore(container.root, child, beforeChild);
  },

  commitUpdate(instance: ElementNode, _type: unknown, _prevProps: Props, nextProps: Props): void {
    instance.props = nextProps;
  },

  commitTextUpdate(textInstance: TextNode, _oldText: string, newText: string): void {
    textInstance.text = newText;
  },

  getRootHostContext() {
    return {};
  },

  getChildHostContext(_parentContext: unknown, _type: ElementType) {
    return {};
  },

  prepareForCommit(): null {
    return null;
  },

  resetAfterCommit(container: Container): void {
    void container.commitUpdate();
  },

  getPublicInstance(instance: ElementNode): ElementNode {
    return instance;
  },

  preparePortalMount(): void {},

  shouldSetTextContent(): boolean {
    return false;
  },

  clearContainer(container: Container): void {
    container.root.children = [];
  },

  getInstanceFromNode(): null {
    return null;
  },

  beforeActiveInstanceBlur(): void {},
  afterActiveInstanceBlur(): void {},
  prepareScopeUpdate(): void {},
  getInstanceFromScope(): null {
    return null;
  },

  detachDeletedInstance(): void {},

  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,

  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  NotPendingTransition: null,
  HostTransitionContext: createContext(null) as unknown as ReactContext<unknown>,

  setCurrentUpdatePriority(newPriority: Reconciler.EventPriority): void {
    currentUpdatePriority = newPriority;
  },
  getCurrentUpdatePriority(): Reconciler.EventPriority {
    return currentUpdatePriority;
  },
  resolveUpdatePriority(): Reconciler.EventPriority {
    return currentUpdatePriority;
  },

  resetFormInstance(): void {},

  requestPostPaintCallback(callback: (time: number) => void): void {
    setTimeout(() => callback(performance.now()), 0);
  },

  shouldAttemptEagerTransition(): boolean {
    return false;
  },

  trackSchedulerEvent(): void {},
  resolveEventType(): null {
    return null;
  },
  resolveEventTimeStamp(): number {
    return Date.now();
  },

  maySuspendCommit(): boolean {
    return false;
  },
  preloadInstance(): boolean {
    return true;
  },
  startSuspendingCommit(): void {},
  suspendInstance(): void {},
  waitForCommitToBeReady(): null {
    return null;
  },
});
