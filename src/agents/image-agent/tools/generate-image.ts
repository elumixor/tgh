import type { PersonGeneration } from "@google/genai";
import type { Tool } from "agents/agent";
import { logger } from "logger";
import { geminiClient, type ReferenceImage } from "services/gemini/gemini";

export const generateImageTool: Tool = {
  definition: {
    name: "generate_image",
    description:
      "Generate images from text description using Gemini AI. Supports style/reference images for consistency. Returns generated image files.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate",
        },
        reference_images: {
          type: "array",
          items: {
            type: "object",
            properties: {
              url: { type: "string", description: "Public URL of reference image" },
              path: { type: "string", description: "Local file path (from download_drive_file, etc.)" },
              base64: { type: "string", description: "Base64-encoded image data" },
              mimeType: { type: "string", description: "MIME type (required for base64)" },
            },
          },
          description:
            "Style/reference images for generation. Use path for Drive downloads. First image is primary style reference.",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
          description: "Aspect ratio. Infer: square/icon→1:1, portrait→9:16 or 3:4, landscape→16:9 or 4:3",
        },
        numberOfImages: {
          type: "number",
          enum: [1, 2, 3, 4],
          description: "Number of variations (1-4). 'give me options' → 2-3",
        },
        personGeneration: {
          type: "string",
          enum: ["dont_allow", "allow_adult", "allow_all"],
          description: "Control people generation. dont_allow if no people wanted",
        },
      },
      required: ["prompt"],
    },
  },
  execute: async (toolInput, context) => {
    const prompt = toolInput.prompt as string;
    const referenceImages = toolInput.reference_images as ReferenceImage[] | undefined;
    const aspectRatio = toolInput.aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | undefined;
    const numberOfImages = (toolInput.numberOfImages as 1 | 2 | 3 | 4 | undefined) ?? 1;
    const personGeneration = toolInput.personGeneration as PersonGeneration | undefined;

    logger.info(
      { prompt, referenceCount: referenceImages?.length ?? 0, aspectRatio, numberOfImages, personGeneration },
      "Image generation request",
    );

    context.onProgress?.({
      type: "status",
      message: `Generating ${numberOfImages} image${numberOfImages > 1 ? "s" : ""}...`,
    });

    const base64Images = await geminiClient.generateImage({
      prompt,
      referenceImages,
      aspectRatio,
      numberOfImages,
      personGeneration,
    });

    const files = base64Images.map((base64, i) => ({
      buffer: Buffer.from(base64, "base64"),
      mimeType: "image/png",
      filename: `generated-${i + 1}.png`,
    }));

    logger.info({ prompt, count: files.length }, "Image generation completed");

    return {
      success: true,
      message: `Generated ${files.length} image${files.length > 1 ? "s" : ""}`,
      prompt,
      files,
    };
  },
};
