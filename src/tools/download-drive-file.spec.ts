import { describe, expect, test } from "bun:test";
import { downloadDriveFileTool } from "./download-drive-file";

describe("downloadDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(downloadDriveFileTool.definition.name).toBe("download_drive_file");
    expect(downloadDriveFileTool.definition.description).toContain("Download a file from Google Drive");
    expect(downloadDriveFileTool.definition.input_schema.required).toContain("file_id");
  });

  test("should require Telegram context", async () => {
    await expect(downloadDriveFileTool.execute({ file_id: "test_id" }, {})).rejects.toThrow(
      "Telegram context required",
    );
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should download and send file to Telegram", async () => {
    // This test requires:
    // 1. A file in Google Drive
    // 2. An active Telegram context
    // 3. Proper permissions
    // Should be tested manually through the bot

    const _testFileId = "YOUR_TEST_FILE_ID"; // Replace with actual test file ID

    // This would require a mock Telegram context
    // For now, this is skipped and should be tested manually
  });
});
