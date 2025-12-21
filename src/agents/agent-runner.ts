import type { Agent, RunResult } from "@openai/agents";
import { run } from "@openai/agents";
import { getContext } from "context-provider";
import { searchMemories } from "services/memory/memory-store";

/**
 * Pre-fetch relevant memories based on user input
 * Returns top 3 most relevant memories
 */
async function fetchRelevantMemories(input: string): Promise<string | null> {
  try {
    const memories = await searchMemories(input, 3);

    if (memories.length === 0) return null;

    // Filter memories with similarity > 0.7 (reasonably relevant)
    const relevantMemories = memories.filter((m) => m.similarity > 0.7);

    if (relevantMemories.length === 0) return null;

    // Format memories for injection
    const memoriesText = relevantMemories
      .map((m, i) => `${i + 1}. ${m.content} (relevance: ${Math.round(m.similarity * 100)}%)`)
      .join("\n");

    return `[Relevant memories from project context:\n${memoriesText}]`;
  } catch (error) {
    console.error("Failed to fetch memories:", error);
    return null;
  }
}

/**
 * Enrich user message with reply context if available
 */
function enrichMessageWithReplyContext(input: string): string {
  const context = getContext();

  // If there's no reply, return original input
  if (!context.repliedToMessage) return input;

  const reply = context.repliedToMessage;
  const replyText = reply.text ?? reply.caption ?? "[media or unsupported content]";
  const replyFrom = reply.from?.first_name ?? "Unknown";

  // Inject reply context at the beginning of the message
  return `[User is replying to a message from ${replyFrom}: "${replyText}"]\n\n${input}`;
}

/**
 * Wrapper around OpenAI SDK's run() function that emits execution events
 * Tracks agent execution start, completion, and errors
 * Automatically injects reply context and relevant memories into the input message
 */
export async function runAgentWithEvents<TOutput = unknown, TContext = unknown, TOutputFormat = unknown>(
  agent: Agent<TContext, TOutputFormat>,
  input: string,
  options?: Parameters<typeof run>[2],
): Promise<RunResult<TOutput>> {
  const context = getContext();
  const startTime = Date.now();

  // Pre-fetch relevant memories
  const memoriesContext = await fetchRelevantMemories(input);

  // Enrich input with reply context
  let enrichedInput = enrichMessageWithReplyContext(input);

  // Inject memories at the beginning if available
  if (memoriesContext) {
    enrichedInput = `${memoriesContext}\n\n${enrichedInput}`;
  }

  // Emit agent started event
  context.events.emit({
    type: "agent_started",
    agentName: agent.name,
    input: enrichedInput,
  });

  try {
    // Use enriched input for the agent call
    const result = await run<TOutput>(agent, enrichedInput, options);
    const durationMs = Date.now() - startTime;

    // Emit agent completed event
    context.events.emit({
      type: "agent_completed",
      agentName: agent.name,
      durationMs,
      success: true,
      outputSummary: JSON.stringify(result.finalOutput).slice(0, 200),
    });

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Emit error event
    context.events.emit({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      source: agent.name,
    });

    // Also emit agent completed with failure
    context.events.emit({
      type: "agent_completed",
      agentName: agent.name,
      durationMs,
      success: false,
    });

    throw error;
  }
}
