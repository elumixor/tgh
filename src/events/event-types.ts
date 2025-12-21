/**
 * Event types for tracking agent and tool execution
 * Used for observability, debugging, and UI visualization
 */

/**
 * Base event with common properties
 */
interface BaseEvent {
  /** Unique event ID */
  id: string;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Job/request ID this event belongs to */
  jobId: string;
}

/**
 * Event emitted when an agent starts execution
 */
export interface AgentStartedEvent extends BaseEvent {
  type: "agent_started";
  /** Name of the agent that started */
  agentName: string;
  /** Input message to the agent */
  input: string;
  /** Parent agent name (if this is a sub-agent call) */
  parentAgent?: string;
}

/**
 * Event emitted when an agent completes execution
 */
export interface AgentCompletedEvent extends BaseEvent {
  type: "agent_completed";
  /** Name of the agent that completed */
  agentName: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Output summary (truncated for large outputs) */
  outputSummary?: string;
}

/**
 * Event emitted when a tool is called
 */
export interface ToolCalledEvent extends BaseEvent {
  type: "tool_called";
  /** Name of the tool */
  toolName: string;
  /** Agent that called the tool */
  calledBy: string;
  /** Tool input parameters (sanitized - no sensitive data) */
  input: Record<string, unknown>;
}

/**
 * Event emitted when a tool completes execution
 */
export interface ToolCompletedEvent extends BaseEvent {
  type: "tool_completed";
  /** Name of the tool */
  toolName: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether execution was successful */
  success: boolean;
  /** Result summary (for Phase 3.2 summarization) */
  result?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Event emitted when an error occurs
 */
export interface ErrorEvent extends BaseEvent {
  type: "error";
  /** Error message */
  message: string;
  /** Error stack trace (if available) */
  stack?: string;
  /** Where the error occurred (agent/tool name) */
  source: string;
}

/**
 * Union of all event types
 */
export type ExecutionEvent =
  | AgentStartedEvent
  | AgentCompletedEvent
  | ToolCalledEvent
  | ToolCompletedEvent
  | ErrorEvent;

/**
 * Event listener callback type
 */
export type EventListener = (event: ExecutionEvent) => void;
