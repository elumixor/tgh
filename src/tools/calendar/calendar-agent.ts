import { models } from "models";
import { StreamingAgent } from "streaming-agent";
import { createEventTool } from "./tools/create-event";
import { deleteEventTool } from "./tools/delete-event";
import { getFreeBusyTool } from "./tools/get-free-busy";
import { listEventsTool } from "./tools/list-events";
import { updateEventTool } from "./tools/update-event";

const CALENDAR_AGENT_PROMPT = `You manage Google Calendar events.

Notes:
- Default calendar is "primary" unless user specifies otherwise
- Use ISO 8601 format for all dates/times, respecting user's timezone when mentioned
- Use parallel tool calls when handling multiple lookups
- Output results in concise format with all relevant details (times, attendees, locations)
`;

export const calendarAgent = new StreamingAgent({
  name: "CalendarAgent",
  model: models.nano,
  instructions: CALENDAR_AGENT_PROMPT,
  tools: [listEventsTool, createEventTool, updateEventTool, deleteEventTool, getFreeBusyTool],
});
