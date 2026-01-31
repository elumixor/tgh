/// <reference path="./jsx.d.ts" />
import { useLinkPreviewOptions } from "app-view/providers/LinkPreviewProvider";
import type { ReactNode } from "react";

export interface LinkPreviewOptions {
  ignored: Set<string>;
  previewUrl?: string;
}

export interface MessageProps {
  children?: ReactNode;
  repliesTo?: number;
  linkPreview?: LinkPreviewOptions;
}

export function Message({ children, repliesTo, linkPreview }: MessageProps) {
  const contextOptions = useLinkPreviewOptions();
  const options = linkPreview ?? contextOptions;

  return (
    <io-message repliesTo={repliesTo} linkPreview={options}>
      {children}
    </io-message>
  );
}
