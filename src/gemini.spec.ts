import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GeminiClient } from "./gemini";

function getPngDimensions(buffer: Uint8Array): { width: number; height: number } {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

describe.skipIf(!process.env.RUN_MANUAL_TESTS)("GeminiClient (manual)", () => {
  let client: GeminiClient;
  const outputDir = join(process.cwd(), "test-output");

  beforeAll(() => {
    client = new GeminiClient();
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  });

  test(
    "should generate a single image",
    async () => {
      const images = await client.generateImage({
        prompt: "A beautiful sunset over mountains",
      });

      expect(images).toBeArray();
      expect(images.length).toBe(1);
      expect(images[0]).toBeString();
      if (!images[0]) throw new Error("No image generated");
      expect(images[0].length).toBeGreaterThan(0);

      const buffer = client.convertBase64ToBuffer(images[0]);
      writeFileSync(join(outputDir, "generated-single.png"), buffer);
    },
    { timeout: 30000 },
  );

  test(
    "should generate multiple images",
    async () => {
      const images = await client.generateImage({
        prompt: "A cat sitting on a chair",
        numberOfImages: 3,
      });

      expect(images).toBeArray();
      expect(images.length).toBe(3);

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        expect(image).toBeString();
        if (!image) throw new Error(`No image generated at index ${i}`);
        expect(image.length).toBeGreaterThan(0);

        const buffer = client.convertBase64ToBuffer(image);
        writeFileSync(join(outputDir, `generated-multi-${i + 1}.png`), buffer);
      }
    },
    { timeout: 30000 },
  );

  test(
    "should generate image with different aspect ratios",
    async () => {
      const aspectRatio = "16:9";
      const images = await client.generateImage({
        prompt: "A wide landscape view of a beach",
        aspectRatio,
      });

      expect(images).toBeArray();
      expect(images.length).toBe(1);
      expect(images[0]).toBeString();
      if (!images[0]) throw new Error("No image generated");

      const buffer = client.convertBase64ToBuffer(images[0]);
      writeFileSync(join(outputDir, `generated-${aspectRatio.replace(":", "x")}.png`), buffer);

      const { width, height } = getPngDimensions(buffer);
      const actualRatio = width / height;
      const expectedRatio = 16 / 9;
      const tolerance = 0.03;

      expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(tolerance);
    },
    { timeout: 30000 },
  );

  afterAll(() => {
    console.log(`\nTest images saved to: ${outputDir}`);
  });
});
