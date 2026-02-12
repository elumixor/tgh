import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const getFreeBusyTool = defineTool(
  "GetFreeBusy",
  "Check availability (free/busy) for calendars in a given time range",
  z.object({
    time_min: z.string().describe("Start of range in ISO 8601 format"),
    time_max: z.string().describe("End of range in ISO 8601 format"),
    calendar_ids: z.array(z.string()).nullable().describe("Calendar IDs to check (default: ['primary'])"),
  }),
  async ({ time_min, time_max, calendar_ids }) => {
    const ids = calendar_ids ?? ["primary"];
    const result = await google.calendar.getFreeBusy(time_min, time_max, ids);
    const calendars = result.calendars ?? {};

    return Object.entries(calendars)
      .map(([calId, info]) => {
        const busy = info.busy ?? [];
        if (busy.length === 0) return `${calId}: Free for the entire range`;
        const slots = busy.map((b) => `  Busy: ${b.start} → ${b.end}`).join("\n");
        return `${calId}:\n${slots}`;
      })
      .join("\n\n");
  },
  { isSensitive: true },
);
