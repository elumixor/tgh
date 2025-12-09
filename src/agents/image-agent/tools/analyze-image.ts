import type { Tool } from "agents/agent";
import { logger } from "logger";
import { geminiClient } from "services/gemini/gemini";

export const analyzeImageTool: Tool = {
  definition: {
    name: "analyze_image",
    description:
      "Analyze an image using Gemini Vision AI. Describes image content, identifies objects, reads text, detects emotions, and provides detailed visual analysis. Use when user asks to analyze, describe, identify, or understand image content. Works with image URLs.",
    input_schema: {
      type: "object",
      properties: {
        imageUrl: {
          type: "string",
          description: "URL of the image to analyze (must be accessible)",
        },
        prompt: {
          type: "string",
          description:
            "Optional specific question or instruction about what to analyze in the image. If not provided, will give general detailed description.",
        },
      },
      required: ["imageUrl"],
    },
  },
  execute: async (toolInput) => {
    const imageUrl = toolInput.imageUrl as string;
    const prompt = toolInput.prompt as string | undefined;

    logger.info({ imageUrl, prompt }, "Image analysis request received");

    try {
      const analysis = await geminiClient.analyzeImage(imageUrl, prompt);
      logger.info({ imageUrl, analysisLength: analysis.length }, "Image analysis completed");
      return { analysis };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error({ imageUrl, error: errorMessage }, "Image analysis failed");
      throw new Error(`Failed to analyze image: ${errorMessage}`);
    }
  },
};
