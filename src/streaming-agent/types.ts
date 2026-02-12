import type { EventEmitter } from "@elumixor/event-emitter";
import type { MCPServer, Tool } from "@openai/agents";
import type { Job } from "jobs/job";
import type { z } from "zod";
import type { DeltaStream } from "./delta-stream";
import type { StreamingAgent } from "./streaming-agent";

export interface ToolCallData {
  type: "tool";
  id: string;
  name: string;
  input: Record<string, unknown>;
  log: EventEmitter<string>;
  output: DeltaStream;
  outputEnded?: boolean;
  outputValue?: string;
}

export interface AgentCallData {
  type: "agent";
  id: string;
  name: string;
  input: string;
  reasoning: DeltaStream;
  output: DeltaStream;
  log: EventEmitter<string>;
  call: EventEmitter<CallData>;
  outputEnded?: boolean;
}

export type CallData = ToolCallData | AgentCallData;

export interface ToolDefinition<TParams extends z.ZodType = z.ZodType, TReturn = unknown> {
  name: string;
  description: string;
  parameters: TParams;
  execute: (params: z.infer<TParams>, context: Job) => TReturn | Promise<TReturn>;
  isSensitive?: boolean;
}

export interface NestedAgent {
  agent: StreamingAgent;
  description: string;
  isSensitive?: boolean;
}

export type ToolInput = ToolDefinition | StreamingAgent | NestedAgent | Tool;

export type InstructionsInput = string | ((context: Job) => string | Promise<string>);

export interface StreamingAgentOptions {
  name: string;
  model: string;
  instructions?: InstructionsInput;
  tools?: ToolInput[];
  mcpServers?: MCPServer[];
  modelSettings?: {
    reasoning?: { effort?: "low" | "medium" | "high"; summary?: "auto" | "concise" | "detailed" };
    text?: { verbosity?: "low" | "medium" | "high" };
  };
}
