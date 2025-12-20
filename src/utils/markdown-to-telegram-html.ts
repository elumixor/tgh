/**
 * Converts Markdown to Telegram-compatible HTML.
 * Telegram supports a limited subset of HTML tags.
 * @see https://core.telegram.org/bots/api#html-style
 */
export function markdownToTelegramHtml(markdown: string): string {
  let html = markdown;

  // Store code blocks with placeholders to prevent formatting inside them
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract code blocks first (before any other processing)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  // Extract inline code
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const placeholder = `\x00INLINECODE${inlineCodes.length}\x00`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Escape any raw HTML in the remaining text (placeholders stay intact)
  html = escapeHtml(html);

  // Headers: Convert to bold with blockquote
  html = html.replace(/^### (.+)$/gm, "<b>$1</b>");
  html = html.replace(/^## (.+)$/gm, "<blockquote><b>$1</b></blockquote>");
  html = html.replace(/^# (.+)$/gm, "<blockquote><b>$1</b></blockquote>");

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

  // Restore code blocks and inline code
  for (const [i, block] of codeBlocks.entries()) html = html.replace(`\x00CODEBLOCK${i}\x00`, block);
  for (const [i, code] of inlineCodes.entries()) html = html.replace(`\x00INLINECODE${i}\x00`, code);

  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
