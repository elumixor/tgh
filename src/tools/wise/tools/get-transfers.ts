import { wise } from "services/wise";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getTransfersTool = defineTool(
  "GetWiseTransfers",
  "Get recent Wise transfers. Optionally filter by status (incoming_payment_waiting, processing, funds_converted, outgoing_payment_sent, cancelled, etc.)",
  z.object({
    status: z.string().nullable().describe("Filter by transfer status, or null for all"),
    limit: z.number().nullable().describe("Max number of transfers to return, or null for default"),
  }),
  async ({ status, limit }) => {
    const profiles = await wise.getProfiles();
    const profile = profiles[0];
    if (!profile) return "No Wise profiles found";

    const transfers = await wise.getTransfers(profile.id, {
      status: status ?? undefined,
      limit: limit ?? undefined,
    });

    if (transfers.length === 0) return "No transfers found";

    return transfers
      .map(
        (t) =>
          `#${t.id} [${t.status}] ${t.sourceValue} ${t.sourceCurrency} → ${t.targetValue} ${t.targetCurrency} (rate: ${t.rate}) | ${t.created} | ref: ${t.reference}`,
      )
      .join("\n");
  },
  { isSensitive: true },
);
