import { describe, expect, test } from "bun:test";
import { uploadDriveFileTool } from "./upload-drive-file";

describe("uploadDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(uploadDriveFileTool.definition.name).toBe("upload_drive_file");
    expect(uploadDriveFileTool.definition.description).toContain("Upload a file from Telegram");
    expect(uploadDriveFileTool.definition.input_schema.required).toContain("message_id");
    expect(uploadDriveFileTool.definition.input_schema.required).toContain("folder_id");
  });

  test("should require Telegram context", async () => {
    await expect(uploadDriveFileTool.execute({ message_id: 123, folder_id: "folder_id" }, {})).rejects.toThrow(
      "Telegram context required",
    );
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should upload file from Telegram to Drive", async () => {
    // This test requires:
    // 1. A file sent to Telegram
    // 2. An active Telegram context
    // 3. A folder ID in Google Drive
    // 4. Proper permissions
    // Should be tested manually through the bot

    const _testMessageId = 123; // Replace with actual message ID
    const _testFolderId = "YOUR_FOLDER_ID"; // Replace with actual folder ID

    // This would require a mock Telegram context
    // For now, this is skipped and should be tested manually
  });
});
