export interface RichTextItem {
  plain_text: string;
  href: string | null;
  annotations: { bold: boolean; italic: boolean; strikethrough: boolean; underline: boolean; code: boolean };
}

export interface NotionProperty {
  type: string;
  content: string;
  relatedDatabaseId?: string;
}

export interface PropertySchema {
  name: string;
  type: string;
}
