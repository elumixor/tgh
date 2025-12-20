import { markdownToTelegramHtml } from "utils";
import type { ElementNode, OutputNode, TextNode } from "../../core/types";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function isTextNode(node: OutputNode): node is TextNode {
  return node.type === "TEXT";
}

type TextMode = "markdown" | "plain";

function serializeTelegramChildren(node: ElementNode, mode: TextMode): string {
  return node.children.map((child) => serializeTelegram(child, mode)).join("");
}

/**
 * Serializes the output tree into Telegram-HTML.
 *
 * Key behavior: plain text nodes are treated as Markdown and converted into Telegram-compatible HTML.
 * This is intentionally Telegram-target-specific so other renderers aren't affected.
 */
export function serializeTelegram(node: OutputNode, mode: TextMode = "markdown"): string {
  if (isTextNode(node)) {
    if (mode === "plain") return escapeHtml(node.text);
    return markdownToTelegramHtml(node.text);
  }

  const children = serializeTelegramChildren(node, node.type === "code" || node.type === "pre" ? "plain" : mode);

  switch (node.type) {
    case "io-root":
    case "io-text":
    case "io-message":
      return children;
    case "b":
      return `<b>${children}</b>`;
    case "i":
      return `<i>${children}</i>`;
    case "u":
      return `<u>${children}</u>`;
    case "a": {
      const href = escapeAttr(String(node.props.href ?? ""));
      return `<a href="${href}">${children}</a>`;
    }
    case "code":
      return `<code>${children}</code>`;
    case "pre":
      return `<pre>${children}</pre>`;
    case "br":
      return "\n";
    case "div":
    case "p":
      return `${children}\n`;
    default:
      return children;
  }
}
