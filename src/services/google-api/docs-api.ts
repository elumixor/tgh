import type { OAuth2Client } from "google-auth-library";
import type { docs_v1, drive_v3 } from "googleapis";
import { google } from "googleapis";
import { logger } from "logger";

export class DocsApi {
  private docsClient: docs_v1.Docs;
  private driveClient: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.docsClient = google.docs({ version: "v1", auth });
    this.driveClient = google.drive({ version: "v3", auth });
    logger.info("Docs API initialized");
  }

  async replaceText(documentId: string, replacements: Record<string, string>): Promise<void> {
    const requests: docs_v1.Schema$Request[] = Object.entries(replacements).map(([placeholder, replacement]) => ({
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: true,
        },
        replaceText: replacement,
      },
    }));

    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    logger.info({ documentId, replacementCount: requests.length }, "Text replaced in document");
  }

  /**
   * Export a Google Doc as PDF
   */
  async exportPdf(documentId: string): Promise<Buffer> {
    const response = await this.driveClient.files.export(
      {
        fileId: documentId,
        mimeType: "application/pdf",
      },
      { responseType: "arraybuffer" },
    );

    const data = response.data as ArrayBuffer;
    logger.info({ documentId, size: data.byteLength }, "Document exported as PDF");
    return Buffer.from(data);
  }
}
