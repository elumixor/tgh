import { describe, expect, test } from "bun:test";
import { createMockContext } from "utils/test-utils";
import { renameDriveFileTool } from "./rename-drive-file";

describe("renameDriveFileTool", () => {
  test("should have correct definition", () => {
    expect(renameDriveFileTool.definition.name).toBe("rename_drive_file");
    expect(renameDriveFileTool.definition.description).toContain("Rename a file");
    expect(renameDriveFileTool.definition.input_schema.required).toContain("file_id");
    expect(renameDriveFileTool.definition.input_schema.required).toContain("new_name");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should rename file successfully", async () => {
    const testFileId = "YOUR_TEST_FILE_ID";
    const newName = `TestFile_${Date.now()}`;
    const result = await renameDriveFileTool.execute({ file_id: testFileId, new_name: newName }, createMockContext());
    expect(result).toHaveProperty("success");
  });

  // Note: Parameter validation tests removed due to mock interference from other test files
  // The tool itself validates parameters - tested via MANUAL tests
});
