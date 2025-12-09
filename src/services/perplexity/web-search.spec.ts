import { describe, expect, it } from "bun:test";
import { validateAnswerWithAI } from "utils/test-utils";
import { webSearch } from "./web-search";

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("web-search (manual)", () => {
  it("should return actual search results", async () => {
    const query = "What is the weather today?";
    const result = await webSearch(query);
    console.log(result);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);

    const answersQuery = await validateAnswerWithAI(query, result as string);
    expect(answersQuery).toBe(true);
  }, 30000);
});
