import { describe, expect, test } from "bun:test";
import { searchDriveFilesTool } from "./search-drive-files";

describe("searchDriveFilesTool", () => {
  test("should have correct definition", () => {
    expect(searchDriveFilesTool.definition.name).toBe("search_drive_files");
    expect(searchDriveFilesTool.definition.description).toContain("Search for files");
    expect(searchDriveFilesTool.definition.input_schema.required).toContain("query");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should search files by query", async () => {
    const result = (await searchDriveFilesTool.execute({ query: "Assets" })) as {
      query: string;
      total_results: number;
      files: unknown[];
    };

    expect(result.query).toBe("Assets");
    expect(result.total_results).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.files)).toBe(true);
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should filter by mime type", async () => {
    const result = (await searchDriveFilesTool.execute({
      query: "Assets",
      mime_type: "application/vnd.google-apps.folder",
    })) as {
      query: string;
      total_results: number;
      files: Array<{ mimeType: string }>;
    };

    expect(result.query).toBe("Assets");
    // All results should be folders
    for (const file of result.files) {
      expect(file.mimeType).toBe("application/vnd.google-apps.folder");
    }
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should respect page size", async () => {
    const result = (await searchDriveFilesTool.execute({
      query: "test",
      page_size: 5,
    })) as {
      total_results: number;
    };

    expect(result.total_results).toBeLessThanOrEqual(5);
  });
});
