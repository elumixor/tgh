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
- **Write self-explanatory code, avoid obvious comments** - code should clearly express what it does through good naming and structure
  - ❌ Bad: `// Get user by ID` then `getUserById(id)`
  - ❌ Bad: `// Loop through items` then `for (const item of items)`
  - ✅ Good: Add comments only when explaining WHY, not WHAT (business logic, non-obvious algorithms, workarounds)
- Keep minimal spacing, avoid excessive blank lines
- Compact object returns when simple (e.g., `return { inlineData: { mimeType, data } };`)
- **Never use `setXXX()`/`getXXX()` methods** - use TypeScript getters/setters instead
- **Never use `||` for defaults** - always use `??` (nullish coalescing) unless you specifically need to handle falsy values
- **Never add unnecessary `?` optional chaining** - if a value is always defined, don't mark it optional
- **Interface vs abstract class**: Use interface when defining a contract with no shared implementation; use abstract class only when there's behavior to share

## Test Creation Guidelines

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

## Agent & Tool Architecture (OpenAI Agents SDK)

We use the OpenAI Agents SDK (`@openai/agents`) for our agent system.

### Tool Creation

Tools are created using the `createTool()` helper from `src/tools/sdk-tool.ts`:

```typescript
import { createTool } from "tools/sdk-tool";
import { z } from "zod";

export const myTool = createTool({
  name: "tool_name",
  description: "Clear description of what the tool does",
  parameters: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  execute: async ({ param1, param2 }, context: AppContext) => {
    // Implementation
    return { result: "data" };
  },
});
```

**Tool Design Principles:**

1. **Don't duplicate** - Before creating a new tool, check if an existing tool can be extended
2. **Don't couple with output** - Tools return data, never send to Telegram/console directly
3. **File outputs** - Return `files: FileData[]` in result; `createTool()` auto-detects and routes via `context.onFile()`
4. **Progress updates** - Use `context.onProgress?.()` for long-running operations
5. **Never use `.optional()` for tool parameters** - Use `.nullable()` instead. `defineTool()` enforces this at the type level. Use `?? default` or `?? undefined` when passing nullable values to functions expecting `undefined`
6. **Never use `z.record()` for tool parameters** - OpenAI rejects `propertyNames` in JSON Schema. Use `z.array(z.object({ key: z.string(), value: z.string() }))` instead and convert to a record in the execute function

### Agent Creation

Agents are created using the OpenAI SDK's `Agent` class:

```typescript
import { Agent } from "@openai/agents";
import { models } from "models";

export const myAgent = new Agent({
  name: "agent_name",
  model: models.fast, // or models.thinking for complex tasks
  instructions: AGENT_PROMPT, // System prompt
  tools: [tool1, tool2, tool3],
  outputType: OutputSchema, // Zod schema for structured output
});
```

**Agent Guidelines:**

- **Model Selection:**
  - `models.nano` (GPT-5 Nano) - Summarization, classification
  - `models.fast` (GPT-5 mini) - Well-defined tasks, precise prompts
  - `models.thinking` (GPT-5.1) - Complex agentic tasks, multi-step workflows
- **Agents are exported as constants** - Not classes (e.g., `export const memoryAgent`)
- **Agents as Tools** - Sub-agents are converted to tools using `.asTool()`:
  ```typescript
  const subAgentTool = subAgent.asTool({
    toolName: "sub_agent",
    toolDescription: "Description of what this agent does",
  });

  const masterAgent = new Agent({
    name: "master_agent",
    tools: [regularTool1, regularTool2, subAgentTool],
  });
  ```
- **Handoffs vs Agents as Tools:**
  - Use **agents as tools** (`.asTool()`) when you need function-like calls with discrete results
  - Use **handoffs** when transferring full conversation control (rare, for chat routing systems)

### Context System

Tools receive `AppContext` which replaces the old `Job` pattern:

```typescript
interface AppContext {
  id: string;
  link: string;
  telegramContext: Context;
  messageId: number;
  chatId: number;
  userMessage: string;
  onProgress?: (event: ProgressEvent) => void;
  onFile?: (file: FileData) => void;
}
```

**Usage:**
- Access Telegram context: `context.telegramContext`
- Report progress: `context.onProgress?.({ type: "status", message: "..." })`
- Send files: Return `{ files: [{ buffer, mimeType, filename }] }` - auto-routed via `onFile`

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

### Running Agents

Use the `runAgent()` wrapper from `src/agents/runner.ts`:

```typescript
import { runAgent } from "agents/runner";
import { masterAgent } from "agents/master-agent/master-agent";

const context: AppContext = job.toAppContext({
  onProgress: (event) => { /* handle progress */ },
  onFile: (file) => { /* handle file output */ },
});

const result = await runAgent(masterAgent, userMessage, context);
// Returns: { success: boolean; result?: TOutput; error?: string }
```

**Integration Points:**
- CLI: `src/cli.ts` - Direct `runAgent()` usage
- Telegram: `src/app.tsx` - Convert Job to AppContext, then run agent
- Job conversion: `job.toAppContext({ onProgress, onFile })` provides context
