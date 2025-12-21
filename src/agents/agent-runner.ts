import type { Agent, RunResult } from "@openai/agents";
import { run } from "@openai/agents";
import { getContext } from "context-provider";

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
 * Automatically injects reply context into the input message
 */
export async function runAgentWithEvents<TOutput = unknown, TContext = unknown, TOutputFormat = unknown>(
  agent: Agent<TContext, TOutputFormat>,
  input: string,
  options?: Parameters<typeof run>[2],
): Promise<RunResult<TOutput>> {
  const context = getContext();
  const startTime = Date.now();

  // Enrich input with reply context
  const enrichedInput = enrichMessageWithReplyContext(input);

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
