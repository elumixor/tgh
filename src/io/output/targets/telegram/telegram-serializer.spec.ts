import { describe, expect, test } from "bun:test";
import type { ElementNode, TextNode } from "../../core/types";
import { serializeTelegram } from "./telegram-serializer";

function t(text: string): TextNode {
  return { type: "TEXT", text };
}

function el(
  type: ElementNode["type"],
  children: Array<ElementNode | TextNode> = [],
  props: ElementNode["props"] = {},
): ElementNode {
  return { type, props, children };
}

describe("serializeTelegram", () => {
  test("converts Markdown in text nodes to Telegram HTML", () => {
    const tree = el("io-message", [t("This is **bold** and *italic* and `code`.")]);

    expect(serializeTelegram(tree)).toBe("This is <b>bold</b> and <i>italic</i> and <code>code</code>.");
  });

  test("does not run Markdown conversion inside <code>", () => {
    const tree = el("io-message", [el("code", [t("**not bold** <tag>")])]);

    expect(serializeTelegram(tree)).toBe("<code>**not bold** &lt;tag&gt;</code>");
  });

  test("does not run Markdown conversion inside <pre>", () => {
    const tree = el("io-message", [el("pre", [t("* not italic\n<raw>")])]);

    expect(serializeTelegram(tree)).toBe("<pre>* not italic\n&lt;raw&gt;</pre>");
  });
});
