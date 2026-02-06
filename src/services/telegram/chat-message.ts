/** biome-ignore-all lint/style/useConsistentMemberAccessibility: Using public to declare mutable class fields */
import { Api } from "telegram/tl";

export interface ChatAttachment {
  type: "photo" | "file" | "voice" | "video";
  id: string;
  extension?: string;
}

export type MessageOrder = "oldest first" | "newest first";

function formatTime(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

function applyEntities(text: string, entities?: Api.TypeMessageEntity[]): string {
  if (!entities || entities.length === 0) return text;

  // Sort by offset descending so insertions don't shift later offsets
  const sorted = [...entities].sort((a, b) => b.offset - a.offset);

  let result = text;
  for (const entity of sorted) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    const inner = result.substring(start, end);

    let replacement: string | undefined;
    if (entity instanceof Api.MessageEntityBold) replacement = `**${inner}**`;
    else if (entity instanceof Api.MessageEntityItalic) replacement = `*${inner}*`;
    else if (entity instanceof Api.MessageEntityCode) replacement = `\`${inner}\``;
    else if (entity instanceof Api.MessageEntityPre) {
      const lang = entity.language ? entity.language : "";
      replacement = `\`\`\`${lang}\n${inner}\n\`\`\``;
    } else if (entity instanceof Api.MessageEntityTextUrl) replacement = `[${inner}](${entity.url})`;
    else if (entity instanceof Api.MessageEntityStrike) replacement = `~~${inner}~~`;
    else if (entity instanceof Api.MessageEntitySpoiler) replacement = `||${inner}||`;

    if (replacement) result = result.substring(0, start) + replacement + result.substring(end);
  }

  return result;
}

export class ChatMessage {
  constructor(
    public id: number,
    public text: string,
    public date: Date,
    public userName?: string,
    public fullName?: string,
    public chatTitle?: string,
    public topicName?: string,
    public attachments?: ChatAttachment[],
  ) {}

  static fromApiMessage(msg: Api.Message, chatTitle?: string, topicsMap?: Map<number, string>): ChatMessage {
    let userName: string | undefined;
    let fullName: string | undefined;
    const sender = msg.sender;

    if (sender && "firstName" in sender) {
      if (sender.username) userName = `@${sender.username}`;
      const nameParts: string[] = [];
      if (sender.firstName) nameParts.push(sender.firstName);
      if (sender.lastName) nameParts.push(sender.lastName);
      if (nameParts.length > 0) fullName = nameParts.join(" ");
    } else if (sender && "title" in sender) {
      fullName = sender.title;
    }

    // Get topic name if in a forum topic
    let topicName: string | undefined;
    const replyTo = msg.replyTo as Record<string, unknown> | undefined;
    if (replyTo && "forumTopic" in replyTo && replyTo.forumTopic === true) {
      const topicId = replyTo.replyToMsgId as number | undefined;
      if (topicId && topicsMap) topicName = topicsMap.get(topicId);
    }

    // Get attachments
    const attachments: ChatAttachment[] = [];
    if (msg.photo) attachments.push({ type: "photo", id: String(msg.photo.id) });
    if (msg.video) attachments.push({ type: "video", id: String(msg.video.id) });
    if (msg.voice) attachments.push({ type: "voice", id: String(msg.voice.id) });
    if (msg.document && !msg.voice && !msg.video) {
      const fileName =
        "attributes" in msg.document
          ? (msg.document.attributes as Array<{ fileName?: string }>)?.find((a) => a.fileName)?.fileName
          : undefined;
      const extension = fileName?.split(".").pop();
      attachments.push({ type: "file", id: String(msg.document.id), extension });
    }

    return new ChatMessage(
      msg.id,
      applyEntities(msg.message ?? "", msg.entities),
      new Date(msg.date * 1000),
      userName,
      fullName,
      chatTitle,
      topicName,
      attachments,
    );
  }

  toXml(): string {
    const attrs: string[] = [];
    attrs.push(`id="${this.id}"`);
    attrs.push(`time="${formatTime(this.date)}"`);
    if (this.userName) attrs.push(`nick="${this.userName}"`);
    if (this.fullName) attrs.push(`name="${this.fullName}"`);
    if (this.chatTitle) attrs.push(`chat="${this.chatTitle}"`);
    if (this.topicName) attrs.push(`topic="${this.topicName}"`);
    const attrStr = ` ${attrs.join(" ")}`;

    const content: string[] = [];
    if (this.text) content.push(this.text);
    if (this.attachments) {
      for (const att of this.attachments) {
        if (att.type === "photo") {
          content.push(`<photo id="${att.id}" />`);
        } else if (att.type === "voice") {
          content.push(`<voice id="${att.id}" />`);
        } else if (att.type === "video") {
          content.push(`<video id="${att.id}" />`);
        } else {
          const extAttr = att.extension ? ` type="${att.extension}"` : "";
          content.push(`<file id="${att.id}"${extAttr} />`);
        }
      }
    }

    return `<message${attrStr}>\n${content.join("\n")}\n</message>`;
  }
}
