import { EventEmitter } from "@elumixor/event-emitter";
import { Agent, type RunStreamEvent, run, type Tool, tool } from "@openai/agents";
import type { Context } from "grammy";
import { z } from "zod";
import { DeltaStream } from "./utils";

export interface AppContext {
  telegramContext?: Context;
  chatId: number;
  messageId: number;
  userMessage: string;
}

export interface ToolCallData {
  type: "tool";
  name: string;
  input: Record<string, unknown>;
  log: EventEmitter<string>;
  output: DeltaStream;
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
  outputEnded?: boolean;
}

export type CallData = ToolCallData | AgentCallData;

export interface ToolDefinition<TParams extends z.ZodType = z.ZodType, TContext = unknown, TReturn = unknown> {
  name: string;
  description: string;
  parameters: TParams;
  // biome-ignore lint/suspicious/noExplicitAny: Allow flexible typing for tool definitions
  execute: (params: any, context: TContext) => TReturn | Promise<TReturn>;
}

export interface NestedAgent<TContext = unknown> {
  // biome-ignore lint/suspicious/noExplicitAny: Allow any output type for nested agents
  agent: StreamingAgent<TContext, any>;
  description: string;
}

export type ToolInput<TContext = unknown> =
  | ToolDefinition<z.ZodType, TContext>
  // biome-ignore lint/suspicious/noExplicitAny: Allow any output type for nested agents
  | StreamingAgent<TContext, any>
  | NestedAgent<TContext>
  | Tool;

export interface StreamingAgentOptions<TContext = unknown, TOutput = unknown> {
  name: string;
  model: string;
  instructions?: string;
  tools?: ToolInput<TContext>[];
  outputType?: z.ZodType<TOutput>;
  modelSettings?: {
    reasoning?: { effort?: "low" | "medium" | "high"; summary?: "auto" | "concise" | "detailed" };
    text?: { verbosity?: "low" | "medium" | "high" };
  };
}

export class StreamingAgent<TContext = unknown, TOutput = unknown> {
  readonly reasoning = new DeltaStream();
  readonly output = new DeltaStream();
  readonly log = new EventEmitter<string>();
  readonly call = new EventEmitter<CallData>();

  private readonly agent;
  private currentMode: "reasoning" | "output" | "tool" = "output";
  private _context: TContext | undefined;

  constructor({
    name,
    tools = [],
    model,
    instructions,
    outputType,
    modelSettings,
  }: StreamingAgentOptions<TContext, TOutput>) {
    this.agent = new Agent({
      name,
      model,
      instructions,
      tools: tools.map((t) => this.wrapTool(t)),
      outputType,
      modelSettings,
    });
  }

  private wrapTool(t: ToolInput<TContext>): Tool {
    if (t instanceof StreamingAgent) return this.wrapNestedAgent(t);
    if ("agent" in t && t.agent instanceof StreamingAgent) return this.wrapNestedAgent(t.agent, t.description);
    if ("execute" in t) return this.wrapToolDefinition(t as ToolDefinition<z.ZodType, TContext>);
    return t as Tool;
  }

  get context(): TContext | undefined {
    return this._context;
  }

  get name() {
    return this.agent.name;
  }

  async run(input: string, context?: TContext): Promise<TOutput> {
    this._context = context;
    this.currentMode = "output";

    const streamResult = await run(this.agent, input, { stream: true });
    for await (const event of streamResult) this.handleStreamEvent(event);

    await streamResult.completed;
    return streamResult.finalOutput as TOutput;
  }

  asTool(description: string): Tool {
    return this.agent.asTool({
      toolDescription: description,
      onStream: ({ event }) => this.handleStreamEvent(event),
    });
  }

  private handleStreamEvent(event: RunStreamEvent) {
    if (event.type !== "raw_model_stream_event" || event.data.type !== "model") return;

    const e = event.data.event as Record<string, unknown>;

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
          break;
      }
      return;
    }

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

    if (e.type === "response.output_item.done") {
      const item = e.item as Record<string, unknown>;
      if (item.type === "reasoning") this.reasoning.ended.emit();
      else if (item.type === "message") this.output.ended.emit();
      this.currentMode = "output";
      return;
    }

    if (e.type === "response.function_call_arguments.done") {
      this.currentMode = "output";
    }
  }

  private wrapNestedAgent(nestedAgent: StreamingAgent<TContext>, description?: string): Tool {
    return tool({
      name: nestedAgent.name,
      description: description ?? `Nested agent: ${nestedAgent.name}`,
      parameters: z.object({
        input: z.string().describe("Input for the nested agent"),
      }),
      execute: async ({ input }) => {
        const callData: AgentCallData = {
          type: "agent",
          name: nestedAgent.name,
          input,
          reasoning: new DeltaStream(),
          output: new DeltaStream(),
          log: new EventEmitter<string>(),
          call: new EventEmitter<CallData>(),
        };

        this.call.emit(callData);

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
          return await nestedAgent.run(input, this._context);
        } finally {
          for (const sub of subs) sub.unsubscribe();
        }
      },
    });
  }

  private wrapToolDefinition(def: ToolDefinition<z.ZodType, TContext>): Tool {
    return tool({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: async (args) => {
        const callData: ToolCallData = {
          type: "tool",
          name: def.name,
          input: args as Record<string, unknown>,
          log: new EventEmitter<string>(),
          output: new DeltaStream(),
        };

        this.call.emit(callData);
        callData.output.started.emit();

        try {
          const result = await def.execute(args, this._context as TContext);
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
