import type { drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

export class DriveFile {
  readonly id;
  readonly name;
  readonly mimeType;
  path;
  readonly isFolder;
  readonly size;
  readonly createdTime;
  readonly modifiedTime;
  readonly parents;
  readonly link;
  readonly children = [] as DriveFile[];

  constructor(
    { id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink }: drive_v3.Schema$File,
    path = "",
  ) {
    this.id = id ?? "";
    this.name = name ?? "Untitled";
    this.mimeType = mimeType ?? "";
    this.path = path;
    this.isFolder = mimeType === FOLDER_MIME;
    this.size = size ? Number.parseInt(size, 10) : undefined;
    this.createdTime = createdTime ?? undefined;
    this.modifiedTime = modifiedTime ?? undefined;
    this.parents = parents ?? undefined;
    this.link = webViewLink ?? `https://drive.google.com/open?id=${this.id}`;
  }

  toXML(indent = 0): string {
    const pad = "  ".repeat(indent);
    const tag = this.isFolder ? "folder" : "file";
    const attrs = [`id="${this.id}"`, `name="${this.name}"`];
    if (!this.isFolder && this.size) attrs.push(`size="${this.size}"`);
    attrs.push(`link="${this.link}"`);

    if (!this.children || this.children.isEmpty) return `${pad}<${tag} ${attrs.join(" ")} />`;

    const childrenXml = this.children.map((c) => c.toXML(indent + 1)).join("\n");
    return `${pad}<${tag} ${attrs.join(" ")}>\n${childrenXml}\n${pad}</${tag}>`;
  }
}
