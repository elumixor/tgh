import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const listEventsTool = defineTool(
  "ListCalendarEvents",
  "List events from Google Calendar in a given time range",
  z.object({
    calendar_id: z.string().nullable().describe("Calendar ID (default: 'primary')"),
    time_min: z.string().describe("Start of range in ISO 8601 format (e.g. 2025-01-01T00:00:00Z)"),
    time_max: z.string().describe("End of range in ISO 8601 format"),
    max_results: z.number().nullable().describe("Maximum number of events to return (default: 50)"),
  }),
  async ({ calendar_id, time_min, time_max, max_results }) => {
    const events = await google.calendar.listEvents(
      calendar_id ?? "primary",
      time_min,
      time_max,
      max_results ?? 50,
    );

    if (events.length === 0) return "No events found in the specified range.";

    return events
      .map((e) => {
        const start = e.start?.dateTime ?? e.start?.date ?? "?";
        const end = e.end?.dateTime ?? e.end?.date ?? "?";
        const attendees = e.attendees?.map((a) => a.email).join(", ");
        return [
          `[${e.id}] ${e.summary ?? "(no title)"}`,
          `  Time: ${start} → ${end}`,
          e.location ? `  Location: ${e.location}` : null,
          attendees ? `  Attendees: ${attendees}` : null,
          e.description ? `  Description: ${e.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
  },
  { isSensitive: true },
);
