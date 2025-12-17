import { existsSync, statSync } from "node:fs";
import { Box, render, Text, useApp, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import React, { useEffect, useState } from "react";
import {
  addMemory,
  deleteMemory,
  getAllMemories,
  type Memory,
  memorySyncService,
  syncWithNotion,
  updateMemory,
} from "../src/services/memory/memory-store";
import type { SyncState } from "../src/services/memory/sync-service";

const CACHE_FILE = "./cache/memories.bin";

interface MemoryMeta {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface EditorState {
  mode: "add" | "edit";
  memoryId?: string;
  content: string;
}

function getNotionUrl(id: string): string {
  if (id.startsWith("temp_")) return "";
  return `https://notion.so/${id.replace(/-/g, "")}`;
}

// Terminal hyperlink using OSC 8 escape sequence
function Link({ url, children }: { url: string; children: string }) {
  if (!url) return <Text dimColor>{children}</Text>;
  return <Text>{`\x1b]8;;${url}\x07${children}\x1b]8;;\x07`}</Text>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return "never";
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

function StatusBar({ syncState }: { syncState: SyncState }) {
  const { status, pendingOperations, lastSync, error } = syncState;

  let statusText = "";
  let color: string = "green";

  if (status === "syncing") {
    return (
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
        <Text color="cyan">
          <Spinner type="dots" /> Syncing...{pendingOperations > 0 ? ` (${pendingOperations} pending)` : ""}
        </Text>
      </Box>
    );
  }

  if (status === "error") {
    statusText = `Sync error: ${error ?? "Unknown error"}`;
    color = "red";
  } else if (pendingOperations > 0) {
    statusText = `Queue: ${pendingOperations} operation${pendingOperations > 1 ? "s" : ""} pending`;
    color = "yellow";
  } else {
    statusText = `All synced (${formatRelativeTime(lastSync)})`;
    color = "green";
  }

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
      <Text color={color}>
        {status === "error" ? "❌" : pendingOperations > 0 ? "⏳" : "✅"} {statusText}
      </Text>
    </Box>
  );
}

function MemoryItemCompact({
  memory,
  index,
  selected,
  isPending,
}: {
  memory: MemoryMeta;
  index: number;
  selected: boolean;
  isPending: boolean;
}) {
  const indicator = selected ? ">" : " ";
  const preview = memory.content.length > 50 ? `${memory.content.slice(0, 47)}...` : memory.content;
  const pendingIndicator = isPending ? " ⏳" : "";

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected}>
        {indicator} [{index + 1}] {preview}
        {pendingIndicator}
      </Text>
    </Box>
  );
}

function MemoryItemExpanded({ memory, index, isPending }: { memory: MemoryMeta; index: number; isPending: boolean }) {
  const date = new Date(memory.createdAt).toLocaleDateString();
  const notionUrl = getNotionUrl(memory.id);
  const pendingIndicator = isPending ? " ⏳" : "";

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan" bold>
          {">"} [{index + 1}] {memory.content}
          {pendingIndicator}
        </Text>
      </Box>
      <Box marginLeft={4}>
        <Text dimColor>
          {date} | {notionUrl ? <Link url={notionUrl}>Open in Notion</Link> : <Text dimColor>Pending sync...</Text>}
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

function HelpBar({ hasEditor }: { hasEditor: boolean }) {
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>
        {hasEditor ? "Enter: save | Esc: cancel" : "↑↓/jk: navigate | a: add | e: edit | x: delete | q: quit"}
      </Text>
    </Box>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { exit } = useApp();

  useInput((input) => {
    if (input === "q" || input === "Q") exit();
    if (input === "a" || input === "A") onAdd();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="yellow">No memories stored.</Text>
      <Text dimColor>Press 'a' to add a memory, or 'q' to quit</Text>
    </Box>
  );
}

function MemoryEditor({
  mode,
  initialContent,
  onSave,
  onCancel,
}: {
  mode: "add" | "edit";
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [cursorPos, setCursorPos] = useState(initialContent.length);

  useInput((input, key) => {
    // Escape to cancel
    if (key.escape) {
      onCancel();
      return;
    }

    // Enter to save
    if (key.return) {
      if (content.trim()) {
        onSave(content.trim());
      }
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        setContent((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
        setCursorPos((prev) => prev - 1);
      }
      return;
    }

    // Arrow keys for cursor movement
    if (key.leftArrow) {
      setCursorPos((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.rightArrow) {
      setCursorPos((prev) => Math.min(content.length, prev + 1));
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      setContent((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
      setCursorPos((prev) => prev + input.length);
    }
  });

  // Display content with cursor
  const displayContent = `${content.slice(0, cursorPos)}│${content.slice(cursorPos)}`;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1} marginY={1}>
      <Text bold color="cyan">
        {mode === "add" ? "Add Memory" : "Edit Memory"}
      </Text>
      <Box marginTop={1}>
        <Text>{displayContent || "│"}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter: save | Esc: cancel</Text>
      </Box>
    </Box>
  );
}

function MemoryList({ initialMemories }: { initialMemories: MemoryMeta[] }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [memories, setMemories] = useState(initialMemories);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(memorySyncService.getState());

  // Subscribe to sync state changes and refresh memories
  useEffect(() => {
    const unsubState = memorySyncService.onStateChange((state) => {
      setSyncState(state);
    });

    const unsubRefresh = memorySyncService.onMemoriesRefresh(() => {
      setMemories(loadMemories());
    });

    return () => {
      unsubState();
      unsubRefresh();
    };
  }, []);

  // Calculate visible window based on terminal height
  const terminalHeight = stdout?.rows ?? 24;
  const reservedLines = editor ? 20 : 14; // More reserved when editor is open
  const visibleCount = Math.max(3, terminalHeight - reservedLines);

  // Calculate scroll offset to keep selected item visible
  const halfVisible = Math.floor(visibleCount / 2);
  let startIndex = Math.max(0, selectedIndex - halfVisible);
  const endIndex = Math.min(memories.length, startIndex + visibleCount);
  if (endIndex === memories.length) startIndex = Math.max(0, endIndex - visibleCount);

  const visibleMemories = memories.slice(startIndex, endIndex);

  useInput(
    (input, key) => {
      if (pendingDelete || editor) return;

      // Navigation
      if (key.upArrow || input === "k" || input === "K") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : memories.length - 1));
        return;
      }
      if (key.downArrow || input === "j" || input === "J") {
        setSelectedIndex((prev) => (prev < memories.length - 1 ? prev + 1 : 0));
        return;
      }

      // Add memory
      if (input === "a" || input === "A") {
        setEditor({ mode: "add", content: "" });
        return;
      }

      // Edit memory
      if ((input === "e" || input === "E") && memories[selectedIndex]) {
        setEditor({
          mode: "edit",
          memoryId: memories[selectedIndex].id,
          content: memories[selectedIndex].content,
        });
        return;
      }

      // Delete
      if (input === "x" || input === "X") {
        if (memories.length > 0) setPendingDelete(true);
        return;
      }

      // Quit
      if (input === "q" || input === "Q") {
        exit();
      }
    },
    { isActive: !pendingDelete && !editor },
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

  const handleEditorSave = async (content: string) => {
    if (!editor) return;

    if (editor.mode === "add") {
      await addMemory(content);
      setMemories(loadMemories());
      setSelectedIndex(memories.length); // Select newly added
    } else if (editor.mode === "edit" && editor.memoryId) {
      await updateMemory(editor.memoryId, content);
      setMemories(loadMemories());
    }

    setEditor(null);
  };

  const handleEditorCancel = () => {
    setEditor(null);
  };

  const handleAddFromEmpty = () => {
    setEditor({ mode: "add", content: "" });
  };

  if (memories.length === 0 && !editor) {
    return (
      <Box flexDirection="column" padding={1}>
        <EmptyState onAdd={handleAddFromEmpty} />
        <StatusBar syncState={syncState} />
      </Box>
    );
  }

  const storageSize = getStorageSize();
  const showScrollIndicator = memories.length > visibleCount;

  return (
    <Box flexDirection="column" padding={1}>
      <Header size={storageSize} count={memories.length} />

      {showScrollIndicator && startIndex > 0 && <Text dimColor> ↑ {startIndex} more above</Text>}

      {visibleMemories.map((memory, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;
        const isPending = memorySyncService.hasPendingOperation(memory.id);

        if (isSelected) {
          return <MemoryItemExpanded key={memory.id} memory={memory} index={actualIndex} isPending={isPending} />;
        }
        return (
          <MemoryItemCompact
            key={memory.id}
            memory={memory}
            index={actualIndex}
            selected={false}
            isPending={isPending}
          />
        );
      })}

      {showScrollIndicator && endIndex < memories.length && (
        <Text dimColor> ↓ {memories.length - endIndex} more below</Text>
      )}

      {editor && (
        <MemoryEditor
          mode={editor.mode}
          initialContent={editor.content}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}

      {pendingDelete && memories[selectedIndex] && (
        <DeletePrompt memory={memories[selectedIndex]} onConfirm={handleConfirmDelete} onCancel={handleCancelDelete} />
      )}

      <HelpBar hasEditor={!!editor} />
      <StatusBar syncState={syncState} />
    </Box>
  );
}

// Load memories from local cache
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

// Main entry - starts immediately with local cache, syncs in background
function main() {
  // Load from local cache immediately (no waiting)
  const memories = loadMemories();

  // Start background sync (non-blocking)
  syncWithNotion();

  // Render immediately
  render(React.createElement(MemoryList, { initialMemories: memories }));
}

main();
