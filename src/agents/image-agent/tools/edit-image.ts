import type { Tool } from "agents/agent";
import { logger } from "logger";
import { geminiClient } from "services/gemini/gemini";

export const editImageTool: Tool = {
  definition: {
    name: "edit_image",
    description:
      "Edit or modify existing images based on text instructions. Supports modifications like changing colors/lighting, adding/removing objects, style transfer. Returns edited image file.",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text instructions describing how to modify the image(s)",
        },
        image_urls: {
          type: "array",
          items: { type: "string" },
          description:
            "Array of image URLs. First image is the main image to edit. Additional images serve as reference/style images.",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
          description: "Aspect ratio for the edited image. Only use if user explicitly requests different ratio.",
        },
      },
      required: ["prompt", "image_urls"],
    },
  },
  execute: async (toolInput, context) => {
    const prompt = toolInput.prompt as string;
    const image_urls = toolInput.image_urls as string[];
    const aspectRatio = toolInput.aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | undefined;

    if (!image_urls || image_urls.length === 0) {
      throw new Error("No image URLs provided. Please attach an image or reply to a message containing an image.");
    }

    const refCount = image_urls.length - 1;
    logger.info({ prompt, imageCount: image_urls.length, aspectRatio }, "Image editing request");

    context.statusMessage.replaceWith(
      refCount > 0
        ? `🎨 Editing image (using ${refCount} reference${refCount > 1 ? "s" : ""})...`
        : "🎨 Editing image...",
    );

    const base64Image = await geminiClient.editImage({
      prompt,
      referenceImages: image_urls,
      aspectRatio,
    });

    const buffer = Buffer.from(base64Image, "base64");

    logger.info({ prompt }, "Image editing completed");

    return {
      success: true,
      message: "Image edited successfully",
      prompt,
      files: [{ buffer, mimeType: "image/png", filename: "edited.png" }],
    };
  },
};
