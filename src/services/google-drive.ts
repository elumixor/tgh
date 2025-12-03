import { type drive_v3, google } from "googleapis";
import { env } from "../env";
import { logger } from "../logger";

let driveClient: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (driveClient) return driveClient;

  const credentials = JSON.parse(env.GOOGLE_DRIVE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  logger.info("Google Drive client initialized");
  return driveClient;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  iconLink?: string;
  isFolder: boolean;
}

export function formatDriveFile(file: drive_v3.Schema$File): DriveFile {
  return {
    id: file.id || "",
    name: file.name || "Untitled",
    mimeType: file.mimeType || "",
    size: file.size || undefined,
    createdTime: file.createdTime || undefined,
    modifiedTime: file.modifiedTime || undefined,
    parents: file.parents || undefined,
    webViewLink: file.webViewLink || undefined,
    iconLink: file.iconLink || undefined,
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
  };
}
