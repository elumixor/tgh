import { escapeXML } from "./notion-api";
import type { NotionProperty } from "./types";

export class NotionPage {
  private _contents: string | null = null;

  constructor(
    readonly id: string,
    readonly title: string,
    readonly properties: Record<string, NotionProperty>,
    private fetchContentsFn: (blockId: string) => Promise<string>,
  ) {}

  async getContents(): Promise<string> {
    if (this._contents !== null) return this._contents;
    this._contents = await this.fetchContentsFn(this.id);
    return this._contents;
  }

  async toXML(): Promise<string> {
    const contents = await this.getContents();
    const props = Object.entries(this.properties)
      .map(([name, p]) => `<property name="${escapeXML(name)}" type="${p.type}">${escapeXML(p.content)}</property>`)
      .join("\n    ");

    return [
      `<page id="${this.id}" title="${escapeXML(this.title)}">`,
      props ? `  <properties>\n    ${props}\n  </properties>` : "  <properties />",
      `  <contents>\n${contents}\n  </contents>`,
      "</page>",
    ].join("\n");
  }
}
