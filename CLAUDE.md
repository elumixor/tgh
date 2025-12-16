# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Development with watch mode
bun run cli          # Interactive CLI for testing (no Telegram)
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
- **Never use `setXXX()`/`getXXX()` methods** - use TypeScript getters/setters instead
- **Never use `||` for defaults** - always use `??` (nullish coalescing) unless you specifically need to handle falsy values
- **Never add unnecessary `?` optional chaining** - if a value is always defined, don't mark it optional
- **Interface vs abstract class**: Use interface when defining a contract with no shared implementation; use abstract class only when there's behavior to share

## Testing Guidelines

- **Test functionality, not implementation details**. Avoid testing:
  - Agent/tool names, descriptions, or schema structures
  - Model names (e.g., "should use sonnet")
  - Thinking budgets or token limits
  - Required parameter lists or tool existence
- **Focus on actual behavior**: Test if agents/tools complete their job successfully
- **Manual tests are acceptable**: If only manual tests exist for a feature, that's fine
- Keep tests that verify error handling and edge cases

## Agent System Prompts

When creating or updating agent system prompts:

- **Minimal & Focused**: Agents know their tools via definitions - don't repeat capabilities
- **Context Placement**: Include only relevant context per agent:
  - Master Agent: Project overview, sub-agent roster
  - Specialized agents: Domain-specific context only (e.g., Telegram for Context Agent, API specifics for Drive Agent)
- **Decision Rules**: Focus on guidelines, patterns, and when to use which approach
- **No Process Explanation**: State what to do, not how the system works
- **Keep Technical Details**: API specifics, operation sequences, data formats where needed

## Tool Design Principles

1. **Don't duplicate - refactor/update existing tools**
   - Before creating a new tool, check if an existing tool can be extended
   - Add parameters/overloads to existing tools instead of creating variants

2. **Don't couple tools with output (Telegram/console)**
   - Tools return data (buffers, results) - NOT send to Telegram directly
   - Output is handled by the IO system (`src/io/`)
   - For file outputs, return `files: FileData[]` in the result
   - The Agent class detects file outputs and sends via MessageHandle

3. **Binary data in results**
   - Return buffers directly in results, not temp file paths
   - See `src/io/types.ts` for FileData interface

## Adding New Tools

1. Create tool file in the appropriate agent's `tools/` directory
2. Export and add to agent's tool array
3. For file outputs: Return `{ files: [{ buffer, mimeType, filename? }] }`
4. Use `context.statusMessage.replaceWith()` for status updates
5. Tools should be synchronous (wait for completion) unless truly long-running

## General Guidelines

- Never run dev in background - ALWAYS ask user to do so. But firstly, check if the process is already running. That is, do this ONLY if you actually require to run the bot. If you just need to test some functionality - write unit tests and run them.

- For quick functionality testing/debugging, use `bun run cli "your prompt here"` to process a single prompt and see the output. Add more logging to trace execution flow if needed.

- When implementing new feature or doing refactoring, make sure there are no problems/errors left. Use `bun run lint` and `CLAUDECODE=1 bun test` to verify. and fix any issues reported. Use `CLAUDECODE=1` to improve readability and reduce context noise.

- For `render` commands always specify `-o` options to specify a non-interactive output mode.

- ALWAYS use `??` operator instead of `||` when providing default values, unless you specifically want to treat falsy values (like `0` or `""`) as needing a default.

- Never split declaration and initialization if it is simple. DON'T do:

```typescript
class Example {
  private readonly field: Field;

  constructor() {
    this.field = new Field();
  }
}
```

Instead, do:

```typescript
class Example {
  private readonly field = new Field();
}
```

- When working on some feature, it is okay to run manual tests. Don't run all tests unless it's ACTUALLY needed. Run only specific tests related to your changes. Once these tests have succeeded, you may run the final automatic (non-manual) unit tests.

## IO Architecture (`src/io/`)

The IO system provides abstracted Input and Output handling for both Telegram and CLI.

### Input System (Event-based)

```typescript
abstract class Input {
  on(event: "message", callback: (msg: Message) => void): void;
  off(event: "message", callback: (msg: Message) => void): void;
}

// Implementations: CLIInput, TelegramInput
// TelegramInput auto-transcribes voice messages via Whisper before emitting
```

### Output System (Fire-and-forget with queue)

```typescript
abstract class Output {
  sendMessage(content: { text: string; files?: FileData[] }): MessageHandle;
}

interface MessageHandle {
  append(text: string): void; // Add text
  addPhoto(file: FileData): void; // Send photo (compressed by Telegram)
  addFile(file: FileData): void; // Send file (no compression)
  replaceWith(text: string): void; // Replace message content
  clear(): void; // Delete/clear message
  createBlock(content: BlockContent): BlockHandle; // Create updatable block
}

// Implementations: ConsoleOutput, TelegramOutput, FileOutput
// OutputGroup combines multiple outputs (continue-on-error)
```

### Usage in Agents

```typescript
// Entry point creates output and passes statusMessage to agent
const output = new ConsoleOutput();
const statusMessage = output.sendMessage({ text: "Processing..." });
await agent.processTask(task, { statusMessage });

// Tools use statusMessage for progress updates
context.statusMessage.replaceWith("🎨 Generating image...");
```
