import { type Context, InputFile } from "grammy";
import { MeshyClient } from "../meshy";
import type { Tool } from "./types";

export const generate3DFromImageTool: Tool = {
	definition: {
		name: "generate_3d_from_image",
		description:
			"Generate a 3D model from an image URL. Use this tool when the user explicitly requests to generate, create, or convert an image to a 3D model. The user's message will often contain an 'Image URL:' line with the Telegram image URL. Extract that URL and pass it to this tool. Do NOT use this tool unless the user clearly wants 3D generation.",
		input_schema: {
			type: "object",
			properties: {
				image_url: {
					type: "string",
					description: "The URL of the image to convert to 3D (often provided as 'Image URL:' in the user's message)",
				},
			},
			required: ["image_url"],
		},
	},
	execute: async (toolInput, context) => {
		const image_url = toolInput.image_url as string;
		const meshyClient = new MeshyClient();

		const taskId = await meshyClient.createImageTo3D({ image_url });

		if (context?.telegramCtx && context?.messageId) {
			handleMeshy3DGeneration(taskId, context.telegramCtx, context.messageId).catch((error) => {
				console.error("Error in background 3D generation:", error);
			});
		}

		return `Started 3D generation task: ${taskId}`;
	},
};

async function handleMeshy3DGeneration(taskId: string, ctx: Context, messageId: number) {
	const meshyClient = new MeshyClient();

	const chatId = ctx.chat?.id ?? 0;

	await ctx.api.editMessageText(chatId, messageId, "🔄 Generating 3D model from image...\nProgress: 0%");

	const finalTask = await meshyClient.pollTask(taskId, async (task) => {
		const statusEmoji = {
			PENDING: "⏳",
			IN_PROGRESS: "🔄",
			SUCCEEDED: "✅",
			FAILED: "❌",
			CANCELED: "🚫",
		}[task.status];

		const progressText = `${statusEmoji} ${task.status}\nProgress: ${task.progress}%`;

		try {
			await ctx.api.editMessageText(chatId, messageId, progressText);
		} catch (error) {
			console.error("Error updating message:", error);
		}
	});

	if (finalTask.status === "SUCCEEDED") {
		const glbUrl = finalTask.model_urls?.glb;
		const fbxUrl = finalTask.model_urls?.fbx;

		if (!glbUrl && !fbxUrl) {
			await ctx.api.editMessageText(chatId, messageId, "✅ 3D generation completed, but no model files were found.");
			return;
		}

		await ctx.api.editMessageText(chatId, messageId, "✅ 3D model generated successfully!\nDownloading files...");

		try {
			if (glbUrl) {
				const glbData = await meshyClient.downloadFile(glbUrl);
				await ctx.api.sendDocument(chatId, new InputFile(glbData, "model.glb"), {
					caption: "GLB Model",
					reply_parameters: { message_id: messageId },
				});
			}

			if (fbxUrl) {
				const fbxData = await meshyClient.downloadFile(fbxUrl);
				await ctx.api.sendDocument(chatId, new InputFile(fbxData, "model.fbx"), {
					caption: "FBX Model",
					reply_parameters: { message_id: messageId },
				});
			}

			await ctx.api.editMessageText(chatId, messageId, "✅ 3D model generated and files sent!");
		} catch (error) {
			console.error("Error sending files:", error);
			await ctx.api.editMessageText(
				chatId,
				messageId,
				`✅ 3D model generated!\n\nDownload links:\n${glbUrl ? `GLB: ${glbUrl}\n` : ""}${fbxUrl ? `FBX: ${fbxUrl}` : ""}`,
			);
		}
	} else if (finalTask.status === "FAILED") {
		await ctx.api.editMessageText(chatId, messageId, `❌ 3D generation failed: ${finalTask.error || "Unknown error"}`);
	} else {
		await ctx.api.editMessageText(chatId, messageId, `🚫 3D generation was ${finalTask.status.toLowerCase()}`);
	}
}
