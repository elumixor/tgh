import { type AppContext, StreamingAgent } from "@agents/streaming-agent";
import { models } from "models";
import { z } from "zod";
import { analyzeImageTool } from "./tools/analyze-image";
import { generate3DFromImageTool } from "./tools/generate-3d-from-image";
import { generateImageTool } from "./tools/generate-image";

const IMAGE_AGENT_PROMPT = `You handle visual content operations.

Tool Behavior:
- generate_image: Synchronous, returns temp file paths. Images auto-sent via output handler.
- analyze_image: Accepts imageUrl (URL) OR imagePath (local file from Drive download)
- generate_3d_from_image: Long-running async operation

Reference Images:
- generate_image supports reference_images[] for style/consistency
- Use path from drive downloads (e.g., download_drive_file result)
- First image is primary style reference

Parameter Inference:
- Aspect ratios: square/icon→1:1, landscape→16:9, portrait→9:16
- Variations/options → numberOfImages=2-3

Focus on visual result, minimal explanation.`;

const ImageOutputSchema = z.object({
  operation: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      description: z.string().optional(),
    }),
  ),
  analysis: z.string().optional(),
  summary: z.string(),
});

export const imageAgent = new StreamingAgent<AppContext>({
  name: "image_agent",
  model: models.fast,
  instructions: IMAGE_AGENT_PROMPT,
  tools: [generateImageTool, analyzeImageTool, generate3DFromImageTool],
  outputType: ImageOutputSchema,
});
