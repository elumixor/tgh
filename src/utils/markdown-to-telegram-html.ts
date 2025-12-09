/**
 * Converts Markdown to Telegram-compatible HTML.
 * Telegram supports a limited subset of HTML tags.
 * @see https://core.telegram.org/bots/api#html-style
 */
export function markdownToTelegramHtml(markdown: string): string {
  let html = markdown;

  // Headers: Convert to bold with blockquote
  html = html.replace(/^### (.+)$/gm, "<b>$1</b>");
  html = html.replace(/^## (.+)$/gm, "<blockquote><b>$1</b></blockquote>");
  html = html.replace(/^# (.+)$/gm, "<blockquote><b>$1</b></blockquote>");

  // Code blocks: Convert triple backticks to <pre><code>
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_match, _lang, code) => `<pre><code>${escapeHtml(code)}</code></pre>`,
  );

  // Inline code: Convert backticks to <code>
  html = html.replace(/`([^`]+)`/g, (_match, code) => `<code>${escapeHtml(code)}</code>`);

  // Bold: Convert **text** or __text__ to <b>
  html = html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  html = html.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: Convert *text* or _text_ to <i>
  html = html.replace(/\*(.+?)\*/g, "<i>$1</i>");
  html = html.replace(/_(.+?)_/g, "<i>$1</i>");

  // Links: Convert [text](url) to <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Strikethrough: Convert ~~text~~ to <s>
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Lists: Convert markdown lists to plain text with bullets (Telegram doesn't support list tags)
  html = html.replace(/^[*-] (.+)$/gm, "• $1");
  html = html.replace(/^(\d+)\. (.+)$/gm, "$1. $2");

  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
