import { beforeAll, describe, expect, test } from "bun:test";
import { analyzeImageTool } from "./analyze-image";

const TEST_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg";

describe("analyze_image tool", () => {
  beforeAll(() => {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for this test");
  });

  test("should analyze an image", async () => {
    const result = await analyzeImageTool.execute({ imageUrl: TEST_IMAGE_URL });
    expect(result).toHaveProperty("analysis");
    expect(typeof (result as { analysis: string }).analysis).toBe("string");
    expect((result as { analysis: string }).analysis.length).toBeGreaterThan(0);
  });

  test("should analyze an image with custom prompt", async () => {
    const result = await analyzeImageTool.execute({
      imageUrl: TEST_IMAGE_URL,
      prompt: "What animal is in this image?",
    });
    expect(result).toHaveProperty("analysis");
    const analysis = (result as { analysis: string }).analysis.toLowerCase();
    expect(analysis).toContain("cat");
  });

  test("should handle network errors gracefully", async () => {
    try {
      await analyzeImageTool.execute({ imageUrl: "http://localhost:99999/nonexistent.jpg" });
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
      expect(error instanceof Error).toBe(true);
    }
  });
});
