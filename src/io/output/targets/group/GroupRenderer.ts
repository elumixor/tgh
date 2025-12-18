import type { IRenderer } from "io/output/core";
import type { ReactNode } from "react";

export class GroupRenderer implements IRenderer {
  private readonly renderers: IRenderer[];

  constructor(...renderers: IRenderer[]) {
    this.renderers = renderers;
  }

  async render(element: ReactNode) {
    await Promise.all(this.renderers.map((r) => r.render(element)));
  }
}
