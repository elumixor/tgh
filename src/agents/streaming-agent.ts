import { EventEmitter } from "@elumixor/event-emitter";
import { Agent, run, tool, type RunStreamEvent, type Tool } from "@openai/agents";
import { z } from "zod";

// ============ Core Interfaces (matching Main.tsx) ============

export interface DeltaStream {
  started: EventEmitter<void>;
  delta: EventEmitter<string>;
  ended: EventEmitter<void>;
}

export interface ToolCallData {
  type: "tool";
  name: string;
  input: Record<string, unknown>;
  log: EventEmitter<string>;
  output: DeltaStream;
  /** Flag set when output has ended - useful for late subscribers */
  outputEnded?: boolean;
}

export interface AgentCallData {
  type: "agent";
  name: string;
  input: string;
  reasoning: DeltaStream;
  output: DeltaStream;
  log: EventEmitter<string>;
  call: EventEmitter<CallData>;
  /** Flag set when output has ended - useful for late subscribers */
  outputEnded?: boolean;
}

export type CallData = ToolCallData | AgentCallData;

/** Helper to create a DeltaStream with fresh EventEmitters */
function createDeltaStream(): DeltaStream {
  return {
    started: new EventEmitter<void>(),
    delta: new EventEmitter<string>(),
    ended: new EventEmitter<void>(),
  };
}

/** Tool definition for StreamingAgent - contains the execute function directly */
export interface ToolDefinition<TParams extends z.ZodType = z.ZodType, TContext = unknown, TReturn = unknown> {
  name: string;
  description: string;
  parameters: TParams;
  // biome-ignore lint/suspicious/noExplicitAny: Allow flexible typing for tool definitions
  execute: (params: any, context: TContext) => TReturn | Promise<TReturn>;
}

// ============ StreamingAgent Class ============

export interface StreamingAgentOptions<TContext = unknown, TOutput = unknown> {
  name: string;
  model: string;
  instructions?: string;
  tools?: (ToolDefinition<z.ZodType, TContext> | StreamingAgent<TContext>)[];
  outputType?: z.ZodType<TOutput>;
  modelSettings?: {
    reasoning?: { effort?: "low" | "medium" | "high"; summary?: "auto" | "concise" | "detailed" };
    text?: { verbosity?: "low" | "medium" | "high" };
  };
}

export class StreamingAgent<TContext = unknown, TOutput = unknown> {
  readonly name: string;

  // EventEmitters for this agent's own events
  readonly reasoning = createDeltaStream();
  readonly output = createDeltaStream();
  readonly log = new EventEmitter<string>();
  readonly call = new EventEmitter<CallData>();

  // Internal OpenAI Agent
  private readonly agent: Agent;

  // Track nested StreamingAgents by their name
  private readonly nestedAgents = new Map<string, StreamingAgent<TContext>>();

  // Current streaming mode
  private currentMode: "reasoning" | "output" | "tool" = "output";

  // Current context (set during run)
  private _context: TContext | undefined;

  // Tool definitions for context passing
  private readonly toolDefinitions: ToolDefinition<z.ZodType, TContext>[] = [];

  constructor(options: StreamingAgentOptions<TContext, TOutput>) {
    this.name = options.name;

    // Process tools - convert StreamingAgents to wrapped tools
    const processedTools: Tool[] = [];

    for (const toolOrAgent of options.tools ?? []) {
      if (toolOrAgent instanceof StreamingAgent) {
        // Store reference to nested StreamingAgent
        this.nestedAgents.set(toolOrAgent.name, toolOrAgent);
        // Create wrapped tool that emits AgentCallData
        processedTools.push(this.wrapNestedAgent(toolOrAgent));
      } else {
        // Store tool definition for context passing
        this.toolDefinitions.push(toolOrAgent);
        // Wrap regular tool definition to emit ToolCallData
        processedTools.push(this.wrapToolDefinition(toolOrAgent));
      }
    }

    // Create the underlying OpenAI Agent
    this.agent = new Agent({
      name: options.name,
      model: options.model,
      instructions: options.instructions,
      tools: processedTools,
      outputType: options.outputType,
      modelSettings: options.modelSettings,
    });
  }

  /** Get current context (available during run) */
  get context(): TContext | undefined {
    return this._context;
  }

  /** Run the agent with streaming events */
  async run(input: string, context?: TContext): Promise<TOutput> {
    // Store context for tools to access
    this._context = context;

    // Reset state
    this.currentMode = "output";

    const streamResult = await run(this.agent, input, { stream: true });

    for await (const event of streamResult) {
      this.handleStreamEvent(event);
    }

    await streamResult.completed;
    return streamResult.finalOutput as TOutput;
  }

  /** Convert this agent to a tool for use in another agent (returns OpenAI tool) */
  asTool(description: string): Tool {
    return this.agent.asTool({
      toolDescription: description,
      onStream: ({ event }) => this.handleStreamEvent(event),
    });
  }

  /** Handle raw OpenAI stream events */
  private handleStreamEvent(event: RunStreamEvent) {
    if (event.type !== "raw_model_stream_event" || event.data.type !== "model") return;

    const e = event.data.event as Record<string, unknown>;

    // Handle delta events
    if (e.delta) {
      const delta = e.delta as string;

      switch (this.currentMode) {
        case "reasoning":
          this.reasoning.delta.emit(delta);
          break;
        case "output":
          this.output.delta.emit(delta);
          break;
        case "tool":
          // Tool deltas are argument streaming, not output - ignore for now
          break;
      }
      return;
    }

    // Handle item added events
    if (e.type === "response.output_item.added") {
      const item = e.item as Record<string, unknown>;

      if (item.type === "reasoning") {
        this.currentMode = "reasoning";
        this.reasoning.started.emit();
      } else if (item.type === "function_call") {
        this.currentMode = "tool";
      } else if (item.type === "message") {
        this.currentMode = "output";
        this.output.started.emit();
      }
      return;
    }

    // Handle item done events
    if (e.type === "response.output_item.done") {
      const item = e.item as Record<string, unknown>;

      if (item.type === "reasoning") {
        this.reasoning.ended.emit();
      } else if (item.type === "message") {
        this.output.ended.emit();
      }

      this.currentMode = "output";
      return;
    }

    // Handle function call arguments done
    if (e.type === "response.function_call_arguments.done") {
      this.currentMode = "output";
    }
  }

  /** Wrap a nested StreamingAgent as a tool that emits AgentCallData */
  private wrapNestedAgent(nestedAgent: StreamingAgent<TContext>): Tool {
    return tool({
      name: nestedAgent.name,
      description: `Nested agent: ${nestedAgent.name}`,
      parameters: z.object({
        input: z.string().describe("Input for the nested agent"),
      }),
      execute: async ({ input }) => {
        // Create AgentCallData for this call
        const callData: AgentCallData = {
          type: "agent",
          name: nestedAgent.name,
          input,
          reasoning: createDeltaStream(),
          output: createDeltaStream(),
          log: new EventEmitter<string>(),
          call: new EventEmitter<CallData>(),
        };

        // Emit the call event to parent
        this.call.emit(callData);

        // Wire up nested agent's events to the callData
        const subs = [
          nestedAgent.reasoning.started.subscribe(() => callData.reasoning.started.emit()),
          nestedAgent.reasoning.delta.subscribe((d) => callData.reasoning.delta.emit(d)),
          nestedAgent.reasoning.ended.subscribe(() => callData.reasoning.ended.emit()),
          nestedAgent.output.started.subscribe(() => callData.output.started.emit()),
          nestedAgent.output.delta.subscribe((d) => callData.output.delta.emit(d)),
          nestedAgent.output.ended.subscribe(() => {
            callData.outputEnded = true;
            callData.output.ended.emit();
          }),
          nestedAgent.log.subscribe((m) => callData.log.emit(m)),
          nestedAgent.call.subscribe((c) => callData.call.emit(c)),
        ];

        try {
          // Run the nested agent with parent's context
          const result = await nestedAgent.run(input, this._context);
          return result;
        } finally {
          // Cleanup subscriptions
          for (const sub of subs) sub.unsubscribe();
        }
      },
    });
  }

  /** Wrap a tool definition to emit ToolCallData */
  private wrapToolDefinition(def: ToolDefinition<z.ZodType, TContext>): Tool {
    return tool({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: async (args) => {
        // Create ToolCallData for this call
        const callData: ToolCallData = {
          type: "tool",
          name: def.name,
          input: args as Record<string, unknown>,
          log: new EventEmitter<string>(),
          output: createDeltaStream(),
        };

        // Emit the call event to parent
        this.call.emit(callData);

        // Mark output started
        callData.output.started.emit();

        try {
          // Execute the original tool with context
          const result = await def.execute(args, this._context as TContext);

          // Emit the result as output delta
          const resultStr = typeof result === "string" ? result : JSON.stringify(result);
          callData.output.delta.emit(resultStr);
          callData.outputEnded = true;
          callData.output.ended.emit();

          return result;
        } catch (error) {
          callData.log.emit(`Error: ${error}`);
          callData.output.ended.emit();
          throw error;
        }
      },
    });
  }
}
