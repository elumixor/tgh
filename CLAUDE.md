# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Development with watch mode
bun test             # Run tests (excludes manual tests)
bun run test:manual  # Run all tests including manual ones
bun run lint         # Check with Biome
bun run format       # Format with Biome
```

## Code Style

- Single-statement blocks: Remove braces, keep on one line (e.g., `if (condition) throw error;`)
- Remove obvious comments explaining what code does (code should be self-explanatory)
- Keep minimal spacing, avoid excessive blank lines
- Compact object returns when simple (e.g., `return { inlineData: { mimeType, data } };`)

## Adding New Tools

1. Add tool definition to `src/tools.ts` tools array
2. Add case in `executeTool()` switch statement
3. For long operations: Return immediately, handle async updates via Telegram context passed to `executeTool()`

- Never run dev in background - ALWAYS ask user to do so. But firstly, check if the process is already running. That is, do this ONLY if you actually require to run the bot. If you just need to test some functionality - write unit tests and run them.
