import { describe, expect, it } from "bun:test";
import { webSearchTool } from "./web-search";

describe("web-search", () => {
  it("should have correct tool definition", () => {
    expect(webSearchTool.definition.name).toBe("web_search");
    expect(webSearchTool.definition.input_schema.required).toContain("query");
  });

  it("should return searching message immediately", async () => {
    const result = await webSearchTool.execute({ query: "test query" });
    expect(result).toBe("Searching the web...");
  });
});
