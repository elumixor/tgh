import { beforeEach, describe, expect, test } from "bun:test";
import { createMockContext, replaceToolsWithMocks } from "utils/test-utils";
import { DriveAgent } from "./drive-agent";

describe("DriveAgent", () => {
  let agent: DriveAgent;
  let mocks: ReturnType<typeof replaceToolsWithMocks>;

  beforeEach(() => {
    agent = new DriveAgent();
    mocks = replaceToolsWithMocks(agent.tools);
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)(
    "[MANUAL] should call list_drive_files or tree_drive for listing",
    async () => {
      await agent.processTask("List all files in the root folder", createMockContext());

      const listMock = mocks.get("list_drive_files");
      const treeMock = mocks.get("tree_drive");
      expect(listMock?.mock.calls.length || treeMock?.mock.calls.length).toBeGreaterThan(0);
    },
  );

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call search_drive_files for searching", async () => {
    await agent.processTask("Search for files with 'test' in the name", createMockContext());

    const searchMock = mocks.get("search_drive_files");
    expect(searchMock).toBeDefined();
    expect(searchMock).toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call create_drive_folder for folder creation", async () => {
    await agent.processTask("Create a new folder called 'TestFolder' in folder ID xyz123", createMockContext());

    const createMock = mocks.get("create_drive_folder");
    expect(createMock).toBeDefined();
    expect(createMock).toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call upload_drive_file for uploading", async () => {
    await agent.processTask("Upload the file from message 123 to folder ID xyz456", createMockContext());

    const uploadMock = mocks.get("upload_drive_file");
    expect(uploadMock).toBeDefined();
    expect(uploadMock).toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call download_drive_file for downloading", async () => {
    await agent.processTask("Download file with ID abc123", createMockContext());

    const downloadMock = mocks.get("download_drive_file");
    expect(downloadMock).toBeDefined();
    expect(downloadMock).toHaveBeenCalled();
  });
});
