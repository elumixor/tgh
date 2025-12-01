import { type Context, InputFile } from "grammy";
import { logger } from "../logger";
import { meshyClient } from "../meshy";
import { safeEditMessageTextFromContext } from "../telegram-utils";
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

    logger.info({ image_url }, "3D generation request received");

    const taskId = await meshyClient.createImageTo3D({ image_url });
    logger.info({ taskId, image_url }, "3D generation task created");

    if (context?.telegramCtx && context?.messageId) {
      handleMeshy3DGeneration(taskId, context.telegramCtx, context.messageId).catch((error) => {
        logger.error({ taskId, error: error instanceof Error ? error.message : error }, "3D generation failed");
      });
    }

    return `Started 3D generation task: ${taskId}`;
  },
};

async function handleMeshy3DGeneration(taskId: string, ctx: Context, messageId: number) {
  const chatId = ctx.chat?.id ?? 0;

  let lastText = await safeEditMessageTextFromContext(
    ctx,
    messageId,
    "🔄 Generating 3D model from image...\nProgress: 0%",
  );

  const finalTask = await meshyClient.pollTask(taskId, async (task) => {
    const statusEmoji = {
      PENDING: "⏳",
      IN_PROGRESS: "🔄",
      SUCCEEDED: "✅",
      FAILED: "❌",
      CANCELED: "🚫",
    }[task.status];

    const progressText = `${statusEmoji} ${task.status}\nProgress: ${task.progress}%`;
    lastText = await safeEditMessageTextFromContext(ctx, messageId, progressText, lastText);
  });

  if (finalTask.status === "SUCCEEDED") {
    const glbUrl = finalTask.model_urls?.glb;
    const fbxUrl = finalTask.model_urls?.fbx;

    if (!glbUrl && !fbxUrl) {
      logger.warn({ taskId }, "3D generation completed but no model files found");
      await safeEditMessageTextFromContext(
        ctx,
        messageId,
        "✅ 3D generation completed, but no model files were found.",
        lastText,
      );
      return;
    }

    logger.info({ taskId, glbUrl, fbxUrl }, "3D generation completed successfully");

    await ctx.replyWithChatAction("upload_document");

    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Failed to delete progress message:", error);
    }

    try {
      const files: string[] = [];

      if (glbUrl) {
        const glbData = await meshyClient.downloadFile(glbUrl);
        await ctx.api.sendDocument(chatId, new InputFile(glbData, "model.glb"), { caption: "GLB Model" });
        files.push("GLB");

        if (fbxUrl) await ctx.replyWithChatAction("upload_document");
      }

      if (fbxUrl) {
        const fbxData = await meshyClient.downloadFile(fbxUrl);
        await ctx.api.sendDocument(chatId, new InputFile(fbxData, "model.fbx"), { caption: "FBX Model" });
        files.push("FBX");
      }

      await ctx.api.sendMessage(chatId, `✅ 3D model generated successfully!\nFormats: ${files.join(", ")}`);
    } catch (error) {
      console.error("Error sending files:", error);
      await ctx.api.sendMessage(
        chatId,
        `✅ 3D model generated!\n\nDownload links:\n${glbUrl ? `GLB: ${glbUrl}\n` : ""}${fbxUrl ? `FBX: ${fbxUrl}` : ""}`,
      );
    }
  } else if (finalTask.status === "FAILED") {
    logger.error({ taskId, error: finalTask.error }, "3D generation failed");
    await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `❌ 3D generation failed: ${finalTask.error || "Unknown error"}`,
      lastText,
    );
  } else {
    logger.warn({ taskId, status: finalTask.status }, "3D generation ended with unexpected status");
    await safeEditMessageTextFromContext(
      ctx,
      messageId,
      `🚫 3D generation was ${finalTask.status.toLowerCase()}`,
      lastText,
    );
  }
}
