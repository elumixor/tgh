import { analyzeImageTool } from "../tools/analyze-image";
import { editImageTool } from "../tools/edit-image";
import { generate3DFromImageTool } from "../tools/generate-3d-from-image";
import { generateImageTool } from "../tools/generate-image";
import { Agent } from "./agent";

const IMAGE_AGENT_PROMPT = `You are the IMAGE AGENT, specialized in visual content operations.

Your tools:
- generate_image: Create new images from text descriptions
- edit_image: Modify existing images with reference images
- analyze_image: Understand and describe image content
- generate_3d_from_image: Convert images to 3D models

Guidelines:
- Infer image parameters from user language:
  * square/icon → 1:1
  * landscape → 16:9 or 4:3
  * portrait → 9:16 or 3:4
- For "variations" or "options", use numberOfImages=2-3
- All generation operations are ASYNC - return immediately, use ProgressHandler
- analyze_image works with both URLs and Telegram file_ids
- generate_3d_from_image is a long-running operation

Response style:
- Direct, concise responses
- Focus on the visual result
- Explain what was created/analyzed
- No unnecessary pleasantries

Context:
- You operate in Telegram - images may be in current or replied-to messages
- Users expect autonomous operation - fetch images proactively`;

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
      "claude-sonnet-4-20250514",
      IMAGE_AGENT_PROMPT,
      [generateImageTool, editImageTool, analyzeImageTool, generate3DFromImageTool],
      2048,
      1024,
    );
  }
}
