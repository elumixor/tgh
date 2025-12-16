import { describe, expect, test } from "bun:test";
import { createMockContext } from "utils/test-utils";
import { listDriveFilesTool } from "./list-drive-files";

// These tests require real Google Drive API and may conflict with mocked tests
// Run with RUN_MANUAL_TESTS=1 bun test
describe("listDriveFilesTool", () => {
  const runManual = !!process.env.RUN_MANUAL_TESTS;

  test("should have correct definition", () => {
    expect(listDriveFilesTool.definition.name).toBe("list_drive_files");
    expect(listDriveFilesTool.definition.description).toContain("List files");
  });

  test.skipIf(!runManual)("[MANUAL] list shared folders", async () => {
    const result = await listDriveFilesTool.execute({}, createMockContext());
    expect(result).toHaveProperty("folder_id");
    expect(result).toHaveProperty("files");
  });

  test.skipIf(!runManual)("[MANUAL] list files in specific folder", async () => {
    const result = await listDriveFilesTool.execute(
      { folder_id: "1WtB8aX6aH5s0_fS6xoQPc_0QOC9Hg5ok" },
      createMockContext(),
    );
    expect(result).toHaveProperty("folder_id");
    expect(result).toHaveProperty("files");
  });
});
