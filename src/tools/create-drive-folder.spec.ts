import { describe, expect, test } from "bun:test";
import type { DriveFile } from "../services/google-drive";
import { createDriveFolderTool } from "./create-drive-folder";
import { deleteDriveFileTool } from "./delete-drive-file";

interface CreateDriveFolderResult {
  success: boolean;
  folder: DriveFile;
  message: string;
}

describe("Create Drive Folder", () => {
  test.skip("create and delete folder in Hypocrisy folder", async () => {
    const hypocrisyFolderId = "1WtB8aX6aH5s0_fS6xoQPc_0QOC9Hg5ok";
    const testFolderName = `test-folder-${Date.now()}`;

    const createResult = (await createDriveFolderTool.execute({
      name: testFolderName,
      parent_folder_id: hypocrisyFolderId,
    })) as CreateDriveFolderResult;

    console.log("Created folder:", createResult);

    expect(createResult.success).toBe(true);
    expect(createResult.folder.name).toBe(testFolderName);
    expect(createResult.folder.isFolder).toBe(true);
    expect(createResult.folder.parents).toContain(hypocrisyFolderId);

    await deleteDriveFileTool.execute({ file_id: createResult.folder.id });
    console.log("Deleted test folder");
  });
});
