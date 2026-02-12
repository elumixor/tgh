import { models } from "models";
import { StreamingAgent } from "streaming-agent";
import { getBalancesTool } from "./tools/get-balances";
import { getRatesTool } from "./tools/get-rates";
import { getTransfersTool } from "./tools/get-transfers";

const WISE_AGENT_PROMPT = `You manage Wise (TransferWise) account operations.

You accept natural language requests about balances, transfers, and exchange rates.

Notes:
- When presenting monetary values, always include the currency code
- Use parallel tool calls when handling multiple lookups
- Output results in concise, human-readable markdown format
`;

export const wiseAgent = new StreamingAgent({
  name: "WiseAgent",
  model: models.fast,
  instructions: WISE_AGENT_PROMPT,
  tools: [getBalancesTool, getRatesTool, getTransfersTool],
});
