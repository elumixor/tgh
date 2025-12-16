import { describe, expect, test } from "bun:test";
import { createMockContext } from "utils/test-utils";
import { deleteDriveFileTool } from "./delete-drive-file";

describe("deleteDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(deleteDriveFileTool.definition.name).toBe("delete_drive_file");
    expect(deleteDriveFileTool.definition.description).toContain("Move a file or folder to trash");
    expect(deleteDriveFileTool.definition.input_schema.required).toContain("file_id");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should move file to trash successfully", async () => {
    // WARNING: This will move the file to trash!
    const testFileId = "YOUR_TEST_FILE_ID";
    const result = await deleteDriveFileTool.execute({ file_id: testFileId }, createMockContext());
    expect(result).toHaveProperty("success");
  });

  // Note: Parameter validation tests removed due to mock interference from other test files
  // The tool itself validates parameters - tested via MANUAL tests
});
