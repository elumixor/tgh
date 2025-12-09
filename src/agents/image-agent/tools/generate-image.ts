import type { PersonGeneration } from "@google/genai";
import type { Tool } from "agents/agent";
import type { Context } from "grammy";
import { logger } from "logger";
import { geminiClient } from "services/gemini/gemini";
import { createProgressHandler } from "utils/progress-handler";

export const generateImageTool: Tool = {
  definition: {
    name: "generate_image",
    description:
      "Generate an image from a text description using Gemini AI. Use when user asks to create, generate, or make an image from text. This creates new images from scratch. Claude should infer configuration options from the user's message if mentioned (e.g., 'square image' → 1:1, 'landscape' → 16:9, 'portrait' → 9:16, 'generate 3 options' → numberOfImages=3).",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate",
        },
        aspectRatio: {
          type: "string",
          enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
          description:
            "Aspect ratio of generated image. Infer from user request: square/icon→1:1, portrait→9:16 or 3:4, landscape→16:9 or 4:3",
        },
        numberOfImages: {
          type: "number",
          enum: [1, 2, 3, 4],
          description:
            "Number of image variations to generate (1-4). Infer from user request: 'give me options', 'show variations' → 2 or 3",
        },
        personGeneration: {
          type: "string",
          enum: ["dont_allow", "allow_adult", "allow_all"],
          description:
            "Control whether to generate people. Use dont_allow if user wants no people, allow_adult for normal usage",
        },
      },
      required: ["prompt"],
    },
  },
  execute: async (toolInput, context) => {
    const prompt = toolInput.prompt as string;
    const aspectRatio = toolInput.aspectRatio as string | undefined;
    const numberOfImages = toolInput.numberOfImages as number | undefined;
    const personGeneration = toolInput.personGeneration as string | undefined;

    logger.info({ prompt, aspectRatio, numberOfImages, personGeneration }, "Image generation request received");

    if (context?.telegramCtx && context?.messageId) {
      handleGeminiGeneration(
        { prompt, aspectRatio, numberOfImages, personGeneration },
        context.telegramCtx,
        context.messageId,
      ).catch((error) =>
        logger.error({ prompt, error: error instanceof Error ? error.message : error }, "Image generation failed"),
      );
    }

    const count = numberOfImages || 1;
    return `Generating ${count} image${count > 1 ? "s" : ""} with Gemini AI...`;
  },
};

async function handleGeminiGeneration(
  params: { prompt: string; aspectRatio?: string; numberOfImages?: number; personGeneration?: string },
  ctx: Context,
  messageId: number,
) {
  const progress = createProgressHandler(ctx, messageId);

  try {
    const count = params.numberOfImages || 1;
    await progress.updateProgress({ text: `🎨 Generating ${count} image${count > 1 ? "s" : ""} with Gemini AI...` });

    const base64Images = await geminiClient.generateImage({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | undefined,
      numberOfImages: params.numberOfImages as 1 | 2 | 3 | 4 | undefined,
      personGeneration: params.personGeneration as PersonGeneration | undefined,
    });

    await progress.sendMultiplePhotosAndFiles({
      items: base64Images.map((image, i) => {
        const imageBuffer = geminiClient.convertBase64ToBuffer(image);
        const photoCaption = base64Images.length > 1 ? `Variation ${i + 1}/${base64Images.length}` : "Generated image";
        return {
          imageData: imageBuffer,
          photoCaption,
          filename: `generated-${i + 1}.png`,
          fileCaption: "Full quality",
        };
      }),
    });

    await progress.sendFinalMessage(
      `✅ Generated ${base64Images.length} image${base64Images.length > 1 ? "s" : ""}\nPrompt: "${params.prompt}"`,
    );

    logger.info({ prompt: params.prompt, count: base64Images.length }, "Image generation completed successfully");
  } catch (error) {
    logger.error(
      { prompt: params.prompt, error: error instanceof Error ? error.message : error },
      "Image generation failed in handler",
    );
    await progress.showError(`Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
