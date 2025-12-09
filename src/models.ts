/**
 * Centralized model definitions for different use cases
 */
export const models = {
  /** Fast routing and simple tasks - use for quick decisions and routing */
  fast: "claude-haiku-4-5",

  /** Complex reasoning and tool use - use for multi-step tasks */
  thinking: "claude-sonnet-4-20250514",
} as const;
