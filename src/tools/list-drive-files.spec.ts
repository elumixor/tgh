import { describe, expect, test } from "bun:test";
import type { DriveFile } from "../services/google-drive";
import { listDriveFilesTool } from "./list-drive-files";

interface ListDriveFilesResult {
  folder_id: string;
  shared: boolean;
  total_files: number;
  files: DriveFile[];
}

describe("Google Drive Integration", () => {
  test("list files from root (should be empty)", async () => {
    const result = (await listDriveFilesTool.execute({})) as ListDriveFilesResult;
    console.log("Root files:", result);
    expect(result.total_files).toBe(0);
  });

  test("list shared files", async () => {
    const result = (await listDriveFilesTool.execute({ shared: true })) as ListDriveFilesResult;
    console.log("Shared files:", result);
    expect(result.total_files).toBeGreaterThan(0);
    expect(result.files).toBeInstanceOf(Array);
    expect(result.files[0]).toHaveProperty("id");
    expect(result.files[0]).toHaveProperty("name");
  });

  test("list files in Hypocrisy folder", async () => {
    const result = (await listDriveFilesTool.execute({
      folder_id: "1WtB8aX6aH5s0_fS6xoQPc_0QOC9Hg5ok",
    })) as ListDriveFilesResult;
    console.log("Files in Hypocrisy:", result);
    expect(result.total_files).toBeGreaterThan(0);
    expect(result.files).toBeInstanceOf(Array);
  });
});
