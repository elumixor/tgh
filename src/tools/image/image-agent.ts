import { models } from "models";
import { StreamingAgent } from "streaming-agent";
import { analyzeImageTool } from "./tools/analyze-image";
import { explainTool } from "./tools/explain";
import { generate3DFromImageTool } from "./tools/generate-3d-from-image";
import { generateImageTool } from "./tools/generate-image";

const IMAGE_AGENT_PROMPT = `You handle visual content operations.

Workflow for message attachments:
1. Use DownloadAttachment to get local file paths from message attachment IDs
2. Pass those paths to the appropriate tool

Reference images support reference_images[] for style/consistency. First image is primary style reference.

Parameter Inference:
- Aspect ratios: square/icon→1:1, landscape→16:9, portrait→9:16
- Variations/options → numberOfImages=2-3

Focus on visual result, minimal explanation.`;

export const imageAgent = new StreamingAgent({
  name: "image_agent",
  model: models.mini,
  instructions: IMAGE_AGENT_PROMPT,
  tools: [generateImageTool, analyzeImageTool, explainTool, generate3DFromImageTool],
});
