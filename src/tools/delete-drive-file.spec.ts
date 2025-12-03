import { describe, expect, test } from "bun:test";
import { deleteDriveFileTool } from "./delete-drive-file";

describe("deleteDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(deleteDriveFileTool.definition.name).toBe("delete_drive_file");
    expect(deleteDriveFileTool.definition.description).toContain("Move a file or folder to trash");
    expect(deleteDriveFileTool.definition.input_schema.required).toContain("file_id");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should move file to trash successfully", async () => {
    // This test requires manual setup:
    // 1. Create a test file in Google Drive that can be deleted
    // 2. Get its file_id
    // 3. Run this test with that file_id
    // WARNING: This will move the file to trash!

    const testFileId = "YOUR_TEST_FILE_ID"; // Replace with actual test file ID

    const result = (await deleteDriveFileTool.execute({
      file_id: testFileId,
    })) as {
      success: boolean;
      file_id: string;
      file_name: string;
      is_folder: boolean;
      message: string;
    };

    expect(result.success).toBe(true);
    expect(result.file_id).toBe(testFileId);
    expect(typeof result.file_name).toBe("string");
    expect(typeof result.is_folder).toBe("boolean");
    expect(result.message).toContain("moved to trash");
  });

  test("should require file_id parameter", async () => {
    await expect(deleteDriveFileTool.execute({})).rejects.toThrow();
  });
});
