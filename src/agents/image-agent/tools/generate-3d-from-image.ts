import type { Tool } from "agents/agent";
import type { Context } from "grammy";
import { logger } from "logger";
import { meshyClient } from "services/meshy/meshy";
import { createProgressHandler } from "utils/progress-handler";

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
  const progress = createProgressHandler(ctx, messageId);

  await progress.updateProgress({ text: "🔄 Generating 3D model from image...\nProgress: 0%" });

  const finalTask = await meshyClient.pollTask(taskId, async (task) => {
    const statusEmoji = {
      PENDING: "⏳",
      IN_PROGRESS: "🔄",
      SUCCEEDED: "✅",
      FAILED: "❌",
      CANCELED: "🚫",
    }[task.status];

    await progress.updateProgress({ text: `${statusEmoji} ${task.status}\nProgress: ${task.progress}%` });
  });

  if (finalTask.status === "SUCCEEDED") {
    const glbUrl = finalTask.model_urls?.glb;
    const fbxUrl = finalTask.model_urls?.fbx;

    if (!glbUrl && !fbxUrl) {
      logger.warn({ taskId }, "3D generation completed but no model files found");
      await progress.showError("3D generation completed, but no model files were found.");
      return;
    }

    logger.info({ taskId, glbUrl, fbxUrl }, "3D generation completed successfully");

    try {
      const files: { data: Buffer; filename: string; caption?: string }[] = [];

      if (glbUrl) {
        const glbData = await meshyClient.downloadFile(glbUrl);
        files.push({ data: glbData, filename: "model.glb", caption: "GLB Model" });
      }

      if (fbxUrl) {
        const fbxData = await meshyClient.downloadFile(fbxUrl);
        files.push({ data: fbxData, filename: "model.fbx", caption: "FBX Model" });
      }

      await progress.sendFiles({ files });
      await progress.sendFinalMessage(
        `✅ 3D model generated successfully!\nFormats: ${files.map((f) => f.filename.split(".")[1]?.toUpperCase()).join(", ")}`,
      );
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, "Error sending files");
      await progress.showError("Failed to send model files");
    }
  } else if (finalTask.status === "FAILED") {
    logger.error({ taskId, error: finalTask.error }, "3D generation failed");
    await progress.showError(`3D generation failed: ${finalTask.error || "Unknown error"}`);
  } else {
    logger.warn({ taskId, status: finalTask.status }, "3D generation ended with unexpected status");
    await progress.showError(`3D generation was ${finalTask.status.toLowerCase()}`);
  }
}
