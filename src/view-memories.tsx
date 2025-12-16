import { existsSync, statSync } from "node:fs";
import { Box, render, Text, useApp, useInput, useStdout } from "ink";
import React, { useState } from "react";
import { deleteMemory, getAllMemories, type Memory, syncWithNotion } from "./services/memory/memory-store";

const CACHE_FILE = "./cache/memories.bin";

interface MemoryMeta {
  id: string; // Notion page ID
  content: string;
  createdAt: string;
  updatedAt: string;
}

function getNotionUrl(id: string): string {
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

// Terminal hyperlink using OSC 8 escape sequence
function Link({ url, children }: { url: string; children: string }) {
  return <Text>{`\x1b]8;;${url}\x07${children}\x1b]8;;\x07`}</Text>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStorageSize(): number {
  return existsSync(CACHE_FILE) ? statSync(CACHE_FILE).size : 0;
}

function Header({ size, count }: { size: number; count: number }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        === Memory Storage ({formatBytes(size)}) ===
      </Text>
      <Text dimColor>
        {count} {count === 1 ? "memory" : "memories"} stored
      </Text>
    </Box>
  );
}

function MemoryItemCompact({ memory, index, selected }: { memory: MemoryMeta; index: number; selected: boolean }) {
  const indicator = selected ? ">" : " ";
  const preview = memory.content.length > 50 ? `${memory.content.slice(0, 47)}...` : memory.content;

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected}>
        {indicator} [{index + 1}] {preview}
      </Text>
    </Box>
  );
}

function MemoryItemExpanded({ memory, index }: { memory: MemoryMeta; index: number }) {
  const date = new Date(memory.createdAt).toLocaleDateString();

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan" bold>
          {">"} [{index + 1}] {memory.content}
        </Text>
      </Box>
      <Box marginLeft={4}>
        <Text dimColor>
          {date} | <Link url={getNotionUrl(memory.id)}>Open in Notion</Link>
        </Text>
      </Box>
    </Box>
  );
}

function DeletePrompt({
  memory,
  onConfirm,
  onCancel,
}: {
  memory: MemoryMeta;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useInput((input) => {
    if (input === "y" || input === "Y") onConfirm();
    else if (input === "n" || input === "N") onCancel();
  });

  const preview = memory.content.length > 30 ? `${memory.content.slice(0, 27)}...` : memory.content;

  return (
    <Box marginTop={1}>
      <Text color="yellow" bold>
        Delete "{preview}"? (y/n)
      </Text>
    </Box>
  );
}

function HelpBar() {
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>↑↓/jk: navigate | x: delete | q: quit</Text>
    </Box>
  );
}

function EmptyState() {
  const { exit } = useApp();

  useInput((input) => {
    if (input === "q" || input === "Q") exit();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow">No memories stored.</Text>
      <Text dimColor>Press q to quit</Text>
    </Box>
  );
}

function MemoryList({ initialMemories }: { initialMemories: MemoryMeta[] }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [memories, setMemories] = useState(initialMemories);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(false);

  // Calculate visible window based on terminal height
  // Reserve: header (3 lines) + help bar (3 lines) + expanded item extra (1 line) + delete prompt (2 lines) + padding (2 lines)
  const terminalHeight = stdout?.rows ?? 24;
  const reservedLines = 11;
  const visibleCount = Math.max(3, terminalHeight - reservedLines);

  // Calculate scroll offset to keep selected item visible
  const halfVisible = Math.floor(visibleCount / 2);
  let startIndex = Math.max(0, selectedIndex - halfVisible);
  const endIndex = Math.min(memories.length, startIndex + visibleCount);
  // Adjust start if we're near the end
  if (endIndex === memories.length) startIndex = Math.max(0, endIndex - visibleCount);

  const visibleMemories = memories.slice(startIndex, endIndex);

  useInput(
    (input, key) => {
      if (pendingDelete) return;

      // Navigation
      if (key.upArrow || input === "k" || input === "K") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : memories.length - 1));
        return;
      }
      if (key.downArrow || input === "j" || input === "J") {
        setSelectedIndex((prev) => (prev < memories.length - 1 ? prev + 1 : 0));
        return;
      }

      // Delete
      if (input === "x" || input === "X") {
        setPendingDelete(true);
        return;
      }

      // Quit
      if (input === "q" || input === "Q") {
        exit();
      }
    },
    { isActive: !pendingDelete },
  );

  const handleConfirmDelete = async () => {
    const memory = memories[selectedIndex];
    if (memory) {
      await deleteMemory(memory.id);
      const newMemories = memories.filter((_, i) => i !== selectedIndex);
      setMemories(newMemories);
      if (selectedIndex >= newMemories.length) setSelectedIndex(Math.max(0, newMemories.length - 1));
    }
    setPendingDelete(false);
  };

  const handleCancelDelete = () => {
    setPendingDelete(false);
  };

  if (memories.length === 0) return <EmptyState />;

  const storageSize = getStorageSize();
  const showScrollIndicator = memories.length > visibleCount;

  return (
    <Box flexDirection="column" padding={1}>
      <Header size={storageSize} count={memories.length} />

      {showScrollIndicator && startIndex > 0 && <Text dimColor> ↑ {startIndex} more above</Text>}

      {visibleMemories.map((memory, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;

        if (isSelected) {
          return <MemoryItemExpanded key={memory.id} memory={memory} index={actualIndex} />;
        }
        return <MemoryItemCompact key={memory.id} memory={memory} index={actualIndex} selected={false} />;
      })}

      {showScrollIndicator && endIndex < memories.length && (
        <Text dimColor> ↓ {memories.length - endIndex} more below</Text>
      )}

      {pendingDelete && memories[selectedIndex] && (
        <DeletePrompt memory={memories[selectedIndex]} onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />
      )}

      <HelpBar />
    </Box>
  );
}

// Load memories and render
function loadMemories(): MemoryMeta[] {
  try {
    const memories = getAllMemories();
    return memories.map((m: Memory) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  } catch {
    return [];
  }
}

// Sync with Notion on startup, then render
async function main() {
  console.log("Syncing with Notion...");
  await syncWithNotion();
  console.clear();
  const memories = loadMemories();
  render(React.createElement(MemoryList, { initialMemories: memories }));
}

main();
