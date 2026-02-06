import type { FileData } from "io/output";
import { logger } from "logger";
import { meshyClient } from "services/meshy/meshy";
import type { ToolDefinition } from "streaming-agent";
import { z } from "zod";

export const generate3DFromImageTool: ToolDefinition = {
  name: "generate_3d_from_image",
  description:
    "Generate a 3D model from an image URL. Long-running operation with progress updates. Returns GLB/FBX model files.",
  parameters: z.object({
    image_url: z.string().describe("The URL of the image to convert to 3D"),
  }),
  execute: async ({ image_url }) => {
    logger.info({ image_url }, "3D generation request");

    const taskId = await meshyClient.createImageTo3D({ image_url });
    logger.info({ taskId, image_url }, "3D generation task created");

    const finalTask = await meshyClient.pollTask(taskId);

    if (finalTask.status !== "SUCCEEDED") {
      const error = finalTask.status === "FAILED" ? finalTask.error : `Status: ${finalTask.status}`;
      throw new Error(`3D generation failed: ${error ?? "Unknown error"}`);
    }

    const glbUrl = finalTask.model_urls?.glb;
    const fbxUrl = finalTask.model_urls?.fbx;

    if (!glbUrl && !fbxUrl) throw new Error("3D generation completed but no model files found");

    logger.info({ taskId, glbUrl, fbxUrl }, "3D generation completed");

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
