import { createContext, type ReactNode, useContext } from "react";

type FinishRenderFn = () => Promise<void>;

const FinishRenderContext = createContext<FinishRenderFn | null>(null);

export function FinishRenderProvider({ onFinish, children }: { onFinish: FinishRenderFn; children: ReactNode }) {
  return <FinishRenderContext.Provider value={onFinish}>{children}</FinishRenderContext.Provider>;
}

export function useFinishRender(): FinishRenderFn {
  const finish = useContext(FinishRenderContext);
  if (!finish) throw new Error("useFinishRender must be used within a renderer");
  return finish;
}
