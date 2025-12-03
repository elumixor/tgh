import { getAPIBalancesTool } from "../tools/get-api-balances";
import { Agent } from "./agent";

const UTILITY_AGENT_PROMPT = `You are the UTILITY AGENT for system operations and monitoring.

Your tools:
- get_api_balances: Check API credits and balances for all services

Guidelines:
- Present balance information clearly and concisely
- Flag low balances or issues
- Explain what each service is used for if relevant

Response style:
- Structured output (use tables/lists when appropriate)
- Highlight important information
- Be concise and direct`;

export class UtilityAgent extends Agent {
  readonly definition = {
    name: "utility_agent",
    description: "System operations and monitoring agent. Use for checking API balances and system status.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The utility task to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super("utility_agent", "claude-sonnet-4-20250514", UTILITY_AGENT_PROMPT, [getAPIBalancesTool], 1024, 512);
  }
}
