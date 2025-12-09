import { beforeEach, describe, expect, test } from "bun:test";
import { replaceToolsWithMocks } from "utils/test-utils";
import { DriveAgent } from "./drive-agent";

describe("DriveAgent", () => {
  let agent: DriveAgent;
  let mocks: ReturnType<typeof replaceToolsWithMocks>;

  beforeEach(() => {
    agent = new DriveAgent();
    mocks = replaceToolsWithMocks(agent.tools);
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call list_drive_files for listing", async () => {
    await agent.processTask("List all files in the root folder");

    const listMock = mocks.get("list_drive_files");
    expect(listMock).toBeDefined();
    expect(listMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== listMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call search_drive_files for searching", async () => {
    await agent.processTask("Search for files with 'test' in the name");

    const searchMock = mocks.get("search_drive_files");
    expect(searchMock).toBeDefined();
    expect(searchMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== searchMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call create_drive_folder for folder creation", async () => {
    await agent.processTask("Create a new folder called 'TestFolder'");

    const createMock = mocks.get("create_drive_folder");
    expect(createMock).toBeDefined();
    expect(createMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== createMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call upload_drive_file for uploading", async () => {
    await agent.processTask("Upload the file from message 123 to Drive");

    const uploadMock = mocks.get("upload_drive_file");
    expect(uploadMock).toBeDefined();
    expect(uploadMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== uploadMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });

  test.if(!!process.env.RUN_MANUAL_TESTS)("[MANUAL] should call download_drive_file for downloading", async () => {
    await agent.processTask("Download file with ID abc123");

    const downloadMock = mocks.get("download_drive_file");
    expect(downloadMock).toBeDefined();
    expect(downloadMock).toHaveBeenCalled();

    const otherMocks = Array.from(mocks.values()).filter((m) => m !== downloadMock);
    for (const mock of otherMocks) expect(mock).not.toHaveBeenCalled();
  });
});
