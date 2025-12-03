import { describe, expect, test } from "bun:test";
import { DriveAgent } from "./drive-agent";

describe("DriveAgent", () => {
  const agent = new DriveAgent();

  test("should have correct definition", () => {
    expect(agent.definition.name).toBe("drive_agent");
    expect(agent.definition.description).toContain("Google Drive");
    expect(agent.definition.input_schema.required).toContain("task");
  });

  test("should have all required tools", () => {
    const toolNames = agent.tools.map((t) => t.definition.name);
    expect(toolNames).toContain("list_drive_files");
    expect(toolNames).toContain("create_drive_folder");
    expect(toolNames).toContain("search_drive_files");
    expect(toolNames).toContain("download_drive_file");
    expect(toolNames).toContain("upload_drive_file");
    expect(toolNames).toContain("rename_drive_file");
    expect(toolNames).toContain("delete_drive_file");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should list drive files", async () => {
    const response = await agent.processTask("List all shared files");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("list_drive_files");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should search drive files", async () => {
    const response = await agent.processTask("Search for files with 'test' in the name");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("search_drive_files");
  });

  test.skipIf(process.env.RUN_MANUAL_TESTS !== "1")("[MANUAL] should create drive folder", async () => {
    const response = await agent.processTask("Create a new folder called 'TestFolder' in the root");
    expect(response.success).toBe(true);
    expect(response.result).toBeTruthy();
    expect(response.toolsUsed).toContain("create_drive_folder");
  });

  test("should require task parameter", async () => {
    await expect(agent.execute({}, {})).rejects.toThrow("Task is required");
  });

  test("should use thinking budget", () => {
    expect(agent.thinkingBudget).toBe(1024);
  });

  test("should use thinking model", () => {
    expect(agent.model).toContain("sonnet");
  });
});
