import type { ReactNode } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "io-message": { children?: ReactNode; repliesTo?: number };
    }
  }
}
