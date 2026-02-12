import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const deleteEventTool = defineTool(
  "DeleteCalendarEvent",
  "Delete an event from Google Calendar",
  z.object({
    calendar_id: z.string().nullable().describe("Calendar ID (default: 'primary')"),
    event_id: z.string().describe("ID of the event to delete"),
  }),
  async ({ calendar_id, event_id }) => {
    await google.calendar.deleteEvent(calendar_id ?? "primary", event_id);
    return `Event ${event_id} deleted.`;
  },
  { isSensitive: true },
);
