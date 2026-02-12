import { env } from "env";
import { google as googleapis } from "googleapis";
import { CalendarApi } from "./calendar-api";
import { DocsApi } from "./docs-api";
import { DriveApi } from "./drive-api";

export class GoogleApi {
  readonly drive;
  readonly docs;
  readonly calendar;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    const auth = new googleapis.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });

    this.drive = new DriveApi(auth);
    this.docs = new DocsApi(auth);
    this.calendar = new CalendarApi(auth);
  }
}

export const google = new GoogleApi(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN);
