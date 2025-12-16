import type { Tool } from "agents/agent";
import type { FileData } from "io";
import { logger } from "logger";
import { meshyClient } from "services/meshy/meshy";

export const generate3DFromImageTool: Tool = {
  definition: {
    name: "generate_3d_from_image",
    description:
      "Generate a 3D model from an image URL. Long-running operation with progress updates. Returns GLB/FBX model files.",
    input_schema: {
      type: "object",
      properties: {
        image_url: {
          type: "string",
          description: "The URL of the image to convert to 3D",
        },
      },
      required: ["image_url"],
    },
  },
  execute: async (toolInput, context) => {
    const image_url = toolInput.image_url as string;

    logger.info({ image_url }, "3D generation request");

    context.statusMessage.replaceWith("🔄 Starting 3D generation...");

    const taskId = await meshyClient.createImageTo3D({ image_url });
    logger.info({ taskId, image_url }, "3D generation task created");

    // Poll for completion with progress updates
    const finalTask = await meshyClient.pollTask(taskId, async (task) => {
      const statusEmoji = {
        PENDING: "⏳",
        IN_PROGRESS: "🔄",
        SUCCEEDED: "✅",
        FAILED: "❌",
        CANCELED: "🚫",
      }[task.status];

      context.statusMessage.replaceWith(`${statusEmoji} ${task.status}: ${task.progress}%`);
    });

    if (finalTask.status !== "SUCCEEDED") {
      const error = finalTask.status === "FAILED" ? finalTask.error : `Status: ${finalTask.status}`;
      throw new Error(`3D generation failed: ${error ?? "Unknown error"}`);
    }

    const glbUrl = finalTask.model_urls?.glb;
    const fbxUrl = finalTask.model_urls?.fbx;

    if (!glbUrl && !fbxUrl) throw new Error("3D generation completed but no model files found");

    logger.info({ taskId, glbUrl, fbxUrl }, "3D generation completed");

    // Download files
    const files: FileData[] = [];

    if (glbUrl) {
      const glbBuffer = await meshyClient.downloadFile(glbUrl);
      files.push({ buffer: glbBuffer, mimeType: "model/gltf-binary", filename: "model.glb" });
    }

    if (fbxUrl) {
      const fbxBuffer = await meshyClient.downloadFile(fbxUrl);
      files.push({ buffer: fbxBuffer, mimeType: "application/octet-stream", filename: "model.fbx" });
    }

    const formats = files.map((f) => f.filename?.split(".")[1]?.toUpperCase()).join(", ");

    return {
      success: true,
      message: `3D model generated (${formats})`,
      taskId,
      files,
    };
  },
};
