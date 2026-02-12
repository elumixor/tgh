import { EventEmitter } from "@elumixor/event-emitter";
import { random } from "@elumixor/frontils";
import { Agent, type RunStreamEvent, run, type Tool, tool, withTrace } from "@openai/agents";
import { env } from "env";
import type { Job } from "jobs/job";
import { z } from "zod";
import { DeltaStream } from "./delta-stream";
import type {
  AgentCallData,
  CallData,
  NestedAgent,
  StreamingAgentOptions,
  ToolCallData,
  ToolDefinition,
  ToolInput,
} from "./types";

export class StreamingAgent {
  readonly reasoning = new DeltaStream();
  readonly output = new DeltaStream();
  readonly log = new EventEmitter<string>();
  readonly call = new EventEmitter<CallData>();

  private readonly agent;
  private currentMode: "reasoning" | "output" | "tool" = "output";
  private _context: Job | undefined;

  constructor({ name, tools = [], mcpServers = [], model, instructions, modelSettings }: StreamingAgentOptions) {
    const agentInstructions =
      typeof instructions === "function"
        ? (runContext: { context: Job }) => instructions(runContext.context)
        : instructions;

    this.agent = new Agent({
      name,
      model,
      instructions: agentInstructions,
      tools: tools.map((t) => this.wrapTool(t)),
      mcpServers,
      modelSettings,
    });
  }

  private wrapTool(t: ToolInput): Tool {
    if (t instanceof StreamingAgent) return this.wrapNestedAgent(t);
    if ("agent" in t && t.agent instanceof StreamingAgent)
      return this.wrapNestedAgent(t.agent, (t as NestedAgent).description, (t as NestedAgent).isSensitive);
    if ("execute" in t) return this.wrapToolDefinition(t as ToolDefinition);
    return t as Tool;
  }

  private assertNotSensitive(name: string) {
    if (!this._context) throw new Error("No context available");
    if (this._context.userId !== env.ALLOWED_USER_ID)
      throw new Error(`Access denied: "${name}" is restricted to the authorized user only.`);
  }

  get name() {
    return this.agent.name;
  }

  async run(input: string, context: Job): Promise<string> {
    this._context = context;
    this.currentMode = "output";

    try {
      return await withTrace(
        "TGH",
        async () => {
          const streamResult = await run(this.agent, input, { context, stream: true });
          for await (const event of streamResult) this.handleStreamEvent(event);

          await streamResult.completed;
          return streamResult.finalOutput as string;
        },
        { traceId: `trace_${context.id}` },
      );
    } finally {
      this.output.ended.emit();
    }
  }

  asTool(description: string): Tool {
    return this.agent.asTool({
      toolDescription: description,
      onStream: ({ event }) => this.handleStreamEvent(event),
    }) as Tool;
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

  private wrapNestedAgent(nestedAgent: StreamingAgent, description?: string, isSensitive?: boolean): Tool {
    return tool({
      name: nestedAgent.name,
      description: description ?? `Nested agent: ${nestedAgent.name}`,
      parameters: z.object({
        input: z.string().describe("Input for the nested agent"),
      }),
      execute: async ({ input }) => {
        if (isSensitive) this.assertNotSensitive(nestedAgent.name);
        const callData: AgentCallData = {
          type: "agent",
          id: random.string(8),
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
          if (!this._context) throw new Error("No context available for nested agent");
          return await nestedAgent.run(input, this._context);
        } catch (error) {
          callData.log.emit(`Error: ${error}`);
          if (!callData.outputEnded) callData.output.ended.emit();
          throw error;
        } finally {
          for (const sub of subs) sub.unsubscribe();
        }
      },
    });
  }

  private wrapToolDefinition(def: ToolDefinition): Tool {
    return tool({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: async (args) => {
        if (def.isSensitive) this.assertNotSensitive(def.name);

        const callData: ToolCallData = {
          type: "tool",
          id: random.string(8),
          name: def.name,
          input: args as Record<string, unknown>,
          log: new EventEmitter<string>(),
          output: new DeltaStream(),
        };

        this.call.emit(callData);
        callData.output.started.emit();

        try {
          const result = await def.execute(args, this._context as Job);
          const resultStr = typeof result === "string" ? result : JSON.stringify(result);
          callData.outputValue = resultStr;
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
