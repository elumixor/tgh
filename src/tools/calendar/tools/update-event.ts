import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const updateEventTool = defineTool(
  "UpdateCalendarEvent",
  "Update an existing Google Calendar event",
  z.object({
    calendar_id: z.string().nullable().describe("Calendar ID (default: 'primary')"),
    event_id: z.string().describe("ID of the event to update"),
    summary: z.string().nullable().describe("New event title"),
    start: z.string().nullable().describe("New start time in ISO 8601 format"),
    end: z.string().nullable().describe("New end time in ISO 8601 format"),
    description: z.string().nullable().describe("New event description"),
    location: z.string().nullable().describe("New event location"),
    attendees: z.array(z.string()).nullable().describe("New list of attendee email addresses"),
  }),
  async ({ calendar_id, event_id, summary, start, end, description, location, attendees }) => {
    const patch: Record<string, unknown> = {};
    if (summary) patch.summary = summary;
    if (start) patch.start = { dateTime: start };
    if (end) patch.end = { dateTime: end };
    if (description) patch.description = description;
    if (location) patch.location = location;
    if (attendees) patch.attendees = attendees.map((email) => ({ email }));

    const event = await google.calendar.updateEvent(calendar_id ?? "primary", event_id, patch);
    return `Event updated: "${event.summary}" [${event.id}]`;
  },
  { isSensitive: true },
);
