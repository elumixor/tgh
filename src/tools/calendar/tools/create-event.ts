import { google } from "services/google-api";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const createEventTool = defineTool(
  "CreateCalendarEvent",
  "Create a new event in Google Calendar",
  z.object({
    calendar_id: z.string().nullable().describe("Calendar ID (default: 'primary')"),
    summary: z.string().describe("Event title"),
    start: z.string().describe("Start time in ISO 8601 format (e.g. 2025-01-15T10:00:00+02:00)"),
    end: z.string().describe("End time in ISO 8601 format"),
    description: z.string().nullable().describe("Event description"),
    location: z.string().nullable().describe("Event location"),
    attendees: z.array(z.string()).nullable().describe("List of attendee email addresses"),
  }),
  async ({ calendar_id, summary, start, end, description, location, attendees }) => {
    const event = await google.calendar.createEvent(calendar_id ?? "primary", {
      summary,
      start: { dateTime: start },
      end: { dateTime: end },
      description: description ?? undefined,
      location: location ?? undefined,
      attendees: attendees?.map((email) => ({ email })),
    });

    return `Event created: "${event.summary}" [${event.id}]\nLink: ${event.htmlLink}`;
  },
  { isSensitive: true },
);
