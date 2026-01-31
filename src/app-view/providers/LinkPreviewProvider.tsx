import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

export interface LinkPreviewOptions {
  ignored: Set<string>;
  previewUrl?: string;
}

interface LinkPreviewContextValue {
  options: LinkPreviewOptions;
  ignoreUrl: (url: string) => void;
  setPreviewUrl: (url: string | undefined) => void;
}

const LinkPreviewContext = createContext<LinkPreviewContextValue | null>(null);

export function LinkPreviewProvider({ children }: { children: ReactNode }) {
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

  const value = useMemo<LinkPreviewContextValue>(
    () => ({
      options: { ignored, previewUrl },
      ignoreUrl: (url) => setIgnored((prev) => new Set(prev).add(url)),
      setPreviewUrl,
    }),
    [ignored, previewUrl],
  );

  return <LinkPreviewContext.Provider value={value}>{children}</LinkPreviewContext.Provider>;
}

export function useLinkPreview(): LinkPreviewContextValue {
  const ctx = useContext(LinkPreviewContext);
  if (!ctx) throw new Error("useLinkPreview must be used within a LinkPreviewProvider");
  return ctx;
}

export function useLinkPreviewOptions(): LinkPreviewOptions | undefined {
  return useContext(LinkPreviewContext)?.options;
}
