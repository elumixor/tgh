import type { Agent, RunResult } from "@openai/agents";
import { run } from "@openai/agents";
import { getContext } from "context-provider";

/**
 * Wrapper around OpenAI SDK's run() function that emits execution events
 * Tracks agent execution start, completion, and errors
 */
export async function runAgentWithEvents<TOutput = unknown, TContext = unknown, TOutputFormat = unknown>(
  agent: Agent<TContext, TOutputFormat>,
  input: string,
  options?: Parameters<typeof run>[2],
): Promise<RunResult<TOutput>> {
  const context = getContext();
  const startTime = Date.now();

  // Emit agent started event
  context.events.emit({
    type: "agent_started",
    agentName: agent.name,
    input,
  });

  try {
    const result = await run<TOutput>(agent, input, options);
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
