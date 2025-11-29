import { type Context, InputFile } from "grammy";
import { GeminiClient } from "../gemini";
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

		if (context?.telegramCtx && context?.messageId) {
			handleGeminiGeneration(
				{ prompt, aspectRatio, numberOfImages, personGeneration },
				context.telegramCtx,
				context.messageId,
			).catch((error) => console.error("Error in image generation:", error));
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
	const geminiClient = new GeminiClient();
	const chatId = ctx.chat?.id ?? 0;

	try {
		const count = params.numberOfImages || 1;
		await ctx.api.editMessageText(
			chatId,
			messageId,
			`🎨 Generating ${count} image${count > 1 ? "s" : ""} with Gemini AI...`,
		);

		const base64Images = await geminiClient.generateImage({
			prompt: params.prompt,
			aspectRatio: params.aspectRatio as "1:1",
			numberOfImages: params.numberOfImages as 1,
			personGeneration: params.personGeneration as "allow_all",
		});

		// Send all generated images
		for (let i = 0; i < base64Images.length; i++) {
			const image = base64Images[i];
			if (!image) continue;

			const imageBuffer = geminiClient.base64ToBuffer(image);
			const caption =
				base64Images.length > 1
					? `Variation ${i + 1}/${base64Images.length}: "${params.prompt}"`
					: `Generated: "${params.prompt}"`;

			await ctx.api.sendPhoto(chatId, new InputFile(imageBuffer, `generated-${i + 1}.png`), {
				caption,
				reply_parameters: { message_id: messageId },
			});
		}

		await ctx.api.editMessageText(
			chatId,
			messageId,
			`✅ Generated ${base64Images.length} image${base64Images.length > 1 ? "s" : ""} successfully!`,
		);
	} catch (error) {
		console.error("Gemini generation error:", error);
		await ctx.api.editMessageText(
			chatId,
			messageId,
			`❌ Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
