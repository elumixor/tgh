import { Agent } from "agents/agent";
import { models } from "models";
import { analyzeImageTool } from "./tools/analyze-image";
import { editImageTool } from "./tools/edit-image";
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

export class ImageAgent extends Agent {
  readonly definition = {
    name: "image_agent",
    description:
      "Visual content operations agent. Use for generating images, editing images, analyzing image content, and creating 3D models from images.",
    input_schema: {
      type: "object" as const,
      properties: {
        task: {
          type: "string" as const,
          description: "The image-related task to perform",
        },
      },
      required: ["task"],
    },
  };

  constructor() {
    super(
      "image_agent",
      models.fast,
      IMAGE_AGENT_PROMPT,
      [generateImageTool, editImageTool, analyzeImageTool, generate3DFromImageTool],
      2048,
      1024,
    );
  }
}
