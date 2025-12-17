import type { Context } from "grammy";
import type { Output } from "../output";
import type { Block, BlockState, FileData, MessageContent, MessageHandle } from "../types";
import { TelegramMessageHandle } from "./telegram-message-handle";

export type Operation =
  | { type: "append"; text: string }
  | { type: "replaceWith"; text: string }
  | { type: "addPhoto"; file: FileData }
  | { type: "addFile"; file: FileData }
  | { type: "clear" };

// Convert snake_case to CamelCase
function toCamelCase(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

// Format name: "drive_agent" -> "Drive", "search_drive_files" -> "SearchDriveFiles"
function formatName(name: string, type: "agent" | "tool"): string {
  const camelName = toCamelCase(name);
  if (type === "agent") return camelName.replace(/Agent$/i, "");
  return camelName;
}

// Get status indicator based on state
function getStatusIndicator(state: BlockState): string {
  if (state === "completed") return "✓";
  if (state === "error") return "✖";
  return "...";
}

// Compute effective state: parent is in_progress if any child is in_progress
function getEffectiveState(block: Block): BlockState {
  if (block.state === "error") return "error";
  const hasInProgressChild = block.children.some((c) => getEffectiveState(c) === "in_progress");
  if (hasInProgressChild) return "in_progress";
  return block.state;
}

export function formatBlock(block: Block, depth = 0): string {
  // Skip MasterAgent blocks - format only their children
  if (block.content.type === "agent" && block.content.name.toLowerCase().includes("master")) {
    return block.children.map((child) => formatBlock(child, depth)).join("\n");
  }

  const indent = "  ".repeat(depth);
  const content = block.content;
  const effectiveState = getEffectiveState(block);
  const status = getStatusIndicator(effectiveState);

  if (content.type === "agent") {
    const name = formatName(content.name, "agent");
    // Show summary first (cleaned), then fall back to task
    const summary = content.summary ?? content.task;

    // Format: Name: summary [status]
    let line = `${indent}${name}`;
    if (summary) line += `: ${summary}`;
    line += ` ${status}`;

    // Add children
    const childLines = block.children.map((child) => formatBlock(child, depth + 1)).filter(Boolean);
    if (childLines.length > 0) return `${line}\n${childLines.join("\n")}`;
    return line;
  }

  if (content.type === "tool") {
    const name = formatName(content.name, "tool");
    // Show only summary - no raw JSON
    const summary = content.error ?? content.summary;

    // Format: └ <b>ToolName</b>: summary [status]
    let line = `${indent}└ <b>${name}</b>`;
    if (summary) line += `: ${summary}`;
    line += ` ${status}`;

    return line;
  }

  if (content.type === "text") return `${indent}${content.text}`;
  if (content.type === "file") return `${indent}${content.data.filename ?? "file"}`;
  if (content.type === "error") return `${indent}${content.message}`;

  return "";
}

export class TelegramOutput implements Output {
  constructor(
    private readonly ctx: Context,
    private readonly debounceMs = 500,
  ) {}

  sendMessage(content: MessageContent): MessageHandle {
    return new TelegramMessageHandle(this.ctx, content, this.debounceMs);
  }
}
