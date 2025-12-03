import { describe, expect, test } from "bun:test";
import { renameDriveFileTool } from "./rename-drive-file";

describe("renameDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(renameDriveFileTool.definition.name).toBe("rename_drive_file");
    expect(renameDriveFileTool.definition.description).toContain("Rename a file");
    expect(renameDriveFileTool.definition.input_schema.required).toContain("file_id");
    expect(renameDriveFileTool.definition.input_schema.required).toContain("new_name");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should rename file successfully", async () => {
    // This test requires manual setup:
    // 1. Create a test file in Google Drive
    // 2. Get its file_id
    // 3. Run this test with that file_id

    const testFileId = "YOUR_TEST_FILE_ID"; // Replace with actual test file ID
    const newName = `TestFile_${Date.now()}`;

    const result = (await renameDriveFileTool.execute({
      file_id: testFileId,
      new_name: newName,
    })) as {
      success: boolean;
      file_id: string;
      old_name: string;
      new_name: string;
      message: string;
    };

    expect(result.success).toBe(true);
    expect(result.file_id).toBe(testFileId);
    expect(result.new_name).toBe(newName);
    expect(result.message).toContain("renamed");
  });

  test("should require file_id parameter", async () => {
    await expect(renameDriveFileTool.execute({ new_name: "test" })).rejects.toThrow();
  });

  test("should require new_name parameter", async () => {
    await expect(renameDriveFileTool.execute({ file_id: "test_id" })).rejects.toThrow();
  });
});
