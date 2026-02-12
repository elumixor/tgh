import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";
import { google } from "googleapis";
import { logger } from "logger";

export class CalendarApi {
  private readonly client;

  constructor(auth: OAuth2Client) {
    this.client = google.calendar({ version: "v3", auth });
  }

  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults = 50,
  ): Promise<calendar_v3.Schema$Event[]> {
    const response = await this.client.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items ?? [];
    logger.info({ calendarId, count: events.length }, "Listed calendar events");
    return events;
  }

  async getEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    const response = await this.client.events.get({ calendarId, eventId });
    logger.info({ calendarId, eventId }, "Retrieved calendar event");
    return response.data;
  }

  async createEvent(
    calendarId: string,
    event: calendar_v3.Schema$Event,
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.client.events.insert({
      calendarId,
      requestBody: event,
    });

    logger.info({ calendarId, eventId: response.data.id }, "Created calendar event");
    return response.data;
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    event: calendar_v3.Schema$Event,
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.client.events.patch({
      calendarId,
      eventId,
      requestBody: event,
    });

    logger.info({ calendarId, eventId }, "Updated calendar event");
    return response.data;
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.client.events.delete({ calendarId, eventId });
    logger.info({ calendarId, eventId }, "Deleted calendar event");
  }

  async getFreeBusy(
    timeMin: string,
    timeMax: string,
    calendarIds: string[],
  ): Promise<calendar_v3.Schema$FreeBusyResponse> {
    const response = await this.client.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: calendarIds.map((id) => ({ id })),
      },
    });

    logger.info({ calendarIds, timeMin, timeMax }, "Checked free/busy");
    return response.data;
  }
}
