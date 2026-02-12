import { wise } from "services/wise";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getBalancesTool = defineTool(
  "GetWiseBalances",
  "Get all Wise account balances across currencies",
  z.object({}),
  async () => {
    const profiles = await wise.getProfiles();
    const profile = profiles[0];
    if (!profile) return "No Wise profiles found";

    const balances = await wise.getBalances(profile.id);
    return balances
      .map((b) => `${b.currency}: ${b.amount.value.toFixed(2)} (reserved: ${b.reservedAmount.value.toFixed(2)})`)
      .join("\n");
  },
  { isSensitive: true },
);
