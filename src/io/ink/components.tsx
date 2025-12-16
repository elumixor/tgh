import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { Block, BlockState } from "../types";

// Get icon based on block type (agents and tools) or state (errors)
function getIcon(block: Block): string {
  if (block.content.type === "agent") return "🚀";
  if (block.content.type === "tool") return "🔧";
  if (block.state === "error") return "✖";
  return "•";
}

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

// Truncate JSON values while keeping all keys visible, filter out 'success' key
function truncateJson(obj: unknown, maxValueLen = 15): string {
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj === "string") {
    return obj.length > maxValueLen ? `"${obj.substring(0, maxValueLen)}..."` : `"${obj}"`;
  }
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return `[${obj.length} items]`;
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj)
      .filter(([k]) => k !== "success")
      .map(([k, v]) => `${k}: ${truncateJson(v, maxValueLen)}`);
    return entries.length > 0 ? `{ ${entries.join(", ")} }` : "";
  }
  return String(obj);
}

const stateColors: Record<BlockState, string> = {
  in_progress: "cyan",
  completed: "green",
  error: "red",
};

interface BlockViewProps {
  block: Block;
  depth?: number;
  verbose: boolean;
}

function getBlockText(block: Block, verbose: boolean): string {
  const content = block.content;
  switch (content.type) {
    case "agent": {
      const name = formatName(content.name, "agent");
      const text = verbose ? content.task : (content.summary ?? content.task);
      if (content.result) return `${name}: ${text ?? "..."} → ${content.result}`;
      return `${name}: ${text ?? "..."}`;
    }
    case "tool": {
      const name = formatName(content.name, "tool");
      const hasInput = content.input && typeof content.input === "object" && Object.keys(content.input).length > 0;
      const inputStr = hasInput ? `(${truncateJson(content.input)})` : "";

      if (content.error) return `${name}${inputStr}: ${content.error}`;

      if (content.result) {
        const resultStr = content.summary ?? truncateJson(content.result);
        return `${name}${inputStr}: ${resultStr}`;
      }

      return `${name}${inputStr || "..."}`;
    }
    case "text":
      return content.text;
    case "file":
      return content.data.filename ?? "file";
    case "error":
      return content.message;
  }
}

// Compute effective state: parent is in_progress if any child is in_progress
function getEffectiveState(block: Block): BlockState {
  if (block.state === "error") return "error";
  const hasInProgressChild = block.children.some((c) => getEffectiveState(c) === "in_progress");
  if (hasInProgressChild) return "in_progress";
  return block.state;
}

export function BlockView({ block, depth = 0, verbose }: BlockViewProps) {
  // Skip MasterAgent blocks - render only their children
  if (block.content.type === "agent" && block.content.name.toLowerCase().includes("master")) {
    return (
      <>
        {block.children.map((child) => (
          <BlockView key={child.id} block={child} depth={depth} verbose={verbose} />
        ))}
      </>
    );
  }

  // Indentation: depth 0 = none, depth 1 = " └ ", depth 2 = "   └ ", etc.
  const prefix = depth > 0 ? `${"  ".repeat(depth - 1)} └ ` : "";
  const effectiveState = getEffectiveState(block);
  const icon = getIcon(block);
  const color = stateColors[effectiveState];
  const text = getBlockText(block, verbose);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{prefix}</Text>
        {effectiveState === "in_progress" && <Spinner type="dots" />}
        {effectiveState !== "in_progress" && <Text>{icon}</Text>}
        <Text color={color}> {text}</Text>
      </Box>
      {block.children.map((child) => (
        <BlockView key={child.id} block={child} depth={depth + 1} verbose={verbose} />
      ))}
    </Box>
  );
}

interface MessageViewProps {
  blocks: Block[];
  verbose: boolean;
}

export function MessageView({ blocks, verbose }: MessageViewProps) {
  return (
    <Box flexDirection="column" paddingY={1}>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} verbose={verbose} />
      ))}
    </Box>
  );
}
