import type { PersonGeneration } from "@google/genai";
import { type Context, InputFile } from "grammy";
import { geminiClient } from "../gemini";
import { logger } from "../logger";
import { safeEditMessageTextFromContext } from "../telegram-utils";
import type { Tool } from "./types";

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
  const chatId = ctx.chat?.id ?? 0;
  let lastText: string | undefined;

  try {
    const count = params.numberOfImages || 1;
    lastText = await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `🎨 Generating ${count} image${count > 1 ? "s" : ""} with Gemini AI...`,
    );

    const base64Images = await geminiClient.generateImage({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio as "1:1",
      numberOfImages: params.numberOfImages as 1,
      personGeneration: params.personGeneration as PersonGeneration.ALLOW_ALL,
    });

    await ctx.replyWithChatAction("upload_document");

    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Failed to delete progress message:", error);
    }

    for (let i = 0; i < base64Images.length; i++) {
      const image = base64Images[i];
      if (!image) continue;

      const imageBuffer = geminiClient.base64ToBuffer(image);
      const caption = base64Images.length > 1 ? `Variation ${i + 1}/${base64Images.length}` : "Generated image";

      await ctx.api.sendDocument(chatId, new InputFile(imageBuffer, `generated-${i + 1}.png`), { caption });

      if (i < base64Images.length - 1) await ctx.replyWithChatAction("upload_document");
    }

    await ctx.api.sendMessage(
      chatId,
      `✅ Generated ${base64Images.length} image${base64Images.length > 1 ? "s" : ""}\nPrompt: "${params.prompt}"`,
    );

    logger.info({ prompt: params.prompt, count: base64Images.length }, "Image generation completed successfully");
  } catch (error) {
    logger.error(
      { prompt: params.prompt, error: error instanceof Error ? error.message : error },
      "Image generation failed in handler",
    );
    await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `❌ Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      lastText,
    );
  }
}
