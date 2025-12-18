// Supported element types (output-agnostic)
export type ElementType =
  | "io-root"
  | "io-message"
  | "io-text"
  | "b"
  | "i"
  | "u"
  | "a"
  | "code"
  | "pre"
  | "br"
  | "div"
  | "p";

// Virtual DOM nodes
export interface TextNode {
  type: "TEXT";
  text: string;
  parent?: ElementNode;
}

export interface ElementNode {
  type: ElementType;
  props: Record<string, unknown>;
  children: OutputNode[];
  parent?: ElementNode;
}

export type OutputNode = TextNode | ElementNode;

// Container for the reconciler
export interface Container {
  root: ElementNode;
  commitUpdate: () => void;
}

// File data for photos/documents (used by some renderers)
export interface FileData {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}
