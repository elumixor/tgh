/// <reference path="./jsx.d.ts" />
import type { ReactNode } from "react";

export interface MessageProps {
  children?: ReactNode;
  repliesTo?: number;
}

export function Message({ children, repliesTo }: MessageProps) {
  return <io-message repliesTo={repliesTo}>{children}</io-message>;
}
