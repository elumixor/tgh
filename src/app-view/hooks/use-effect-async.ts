import { type DependencyList, useEffect } from "react";

export function useEffectAsync(callback: () => Promise<void>, deps: DependencyList) {
  useEffect(() => {
    void callback();
  }, deps);
}
