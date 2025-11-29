import { type Context, InputFile } from "grammy";
import { GeminiClient } from "../gemini";
import type { Tool } from "./types";

export const editImageTool: Tool = {
	definition: {
		name: "edit_image",
		description:
			"Edit or modify existing images based on text instructions. Supports modifications like changing colors/lighting, adding/removing objects, style transfer (applying artistic styles from reference images), and iterative refinement. Extract image URLs from the 'Image URLs: [...]' in the user's message. First image is always the main image to edit, additional images are style/context references.",
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
						"Array of Telegram image URLs. First image is the main image to edit. Additional images serve as reference/style images for style transfer or context.",
				},
				aspectRatio: {
					type: "string",
					enum: ["1:1", "3:4", "4:3", "9:16", "16:9"],
					description:
						"Aspect ratio for the edited image. Only use if user explicitly requests a different aspect ratio than the original",
				},
			},
			required: ["prompt", "image_urls"],
		},
	},
	execute: async (toolInput, context) => {
		const prompt = toolInput.prompt as string;
		const image_urls = toolInput.image_urls as string[];
		const aspectRatio = toolInput.aspectRatio as string | undefined;

		if (!image_urls || image_urls.length === 0) {
			return "No image URLs provided. Please attach an image or reply to a message containing an image.";
		}

		if (context?.telegramCtx && context?.messageId) {
			handleGeminiEditing(
				{ prompt, referenceImages: image_urls, aspectRatio },
				context.telegramCtx,
				context.messageId,
			).catch((error) => console.error("Error in image editing:", error));
		}

		const refCount = image_urls.length - 1;
		return refCount > 0
			? `Editing image with Gemini AI (using ${refCount} reference image${refCount > 1 ? "s" : ""})`
			: "Editing image with Gemini AI...";
	},
};

async function handleGeminiEditing(
	params: { prompt: string; referenceImages: string[]; aspectRatio?: string },
	ctx: Context,
	messageId: number,
) {
	const geminiClient = new GeminiClient();
	const chatId = ctx.chat?.id ?? 0;

	try {
		const refCount = params.referenceImages.length - 1;
		const statusText =
			refCount > 0
				? `🎨 Editing image with Gemini AI...\nUsing ${refCount} reference image${refCount > 1 ? "s" : ""} for style/context`
				: "🎨 Editing image with Gemini AI...";

		await ctx.api.editMessageText(chatId, messageId, statusText);

		const base64Image = await geminiClient.editImage({
			prompt: params.prompt,
			referenceImages: params.referenceImages,
			aspectRatio: params.aspectRatio as "1:1",
		});
		const imageBuffer = geminiClient.base64ToBuffer(base64Image);

		await ctx.api.sendPhoto(chatId, new InputFile(imageBuffer, "edited.png"), {
			caption: `Edited: "${params.prompt}"`,
			reply_parameters: { message_id: messageId },
		});

		await ctx.api.editMessageText(chatId, messageId, "✅ Image edited successfully!");
	} catch (error) {
		console.error("Gemini editing error:", error);
		await ctx.api.editMessageText(
			chatId,
			messageId,
			`❌ Image editing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}
