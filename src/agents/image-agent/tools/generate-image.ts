import type { ToolDefinition } from "@agents/streaming-agent";
import { geminiClient } from "services/gemini/gemini";
import { saveTempFile } from "utils";
import { z } from "zod";

export const generateImageTool: ToolDefinition = {
  name: "generate_image",
  description:
    "Generate NEW images or EDIT existing ones using Gemini Nano Banana. Supports creation, targeted edits, style transfer, and character consistency. The tool expects a well-structured narrative prompt and optional reference images. Returns { files: string[]; texts: string[] }.",
  parameters: z.object({
    prompt: z.string().describe(
      `
PURPOSE
Create a high-quality text prompt for image generation or image editing.

The tool supports two modes:
- NEW IMAGE generation
- EDITING an existing image

────────────────────────
MUST (Required)
────────────────────────
1. Write a narrative prompt in full sentences.
2. Explicitly indicate intent:
   - NEW IMAGE: creating a new image
   - EDIT IMAGE: modifying an existing image
3. If reference images are used, label them clearly:
   - "Image 1:", "Image 2:", etc.
4. For EDIT IMAGE:
   - Specify what should change.
   - Specify what must remain unchanged.

────────────────────────
SHOULD (Strongly Recommended)
────────────────────────
- Be hyper-specific about:
  pose, action, facial expression, style, lighting, composition, mood.
- Use constraint language for edits:
  "change only X", "keep face and proportions consistent".
- When style transfer is required, describe the stylistic elements
  (brushwork, palette, line quality, rendering approach).

────────────────────────
OPTIONAL (If Useful)
────────────────────────
- Request multiple variations and specify what differs.
- Specify aspect ratio or framing (e.g., square, 16:9).
- Mention output quality (high resolution, detailed rendering).

────────────────────────
REFERENCE IMAGE GUIDANCE
────────────────────────
- NEW IMAGE:
  Image 1 → style reference or character reference.
- EDIT IMAGE:
  Image 1 → source image to modify.
  Image 2 → optional style reference.

────────────────────────
BEHAVIOR
────────────────────────
If the user request is vague, infer intent and expand it into a
compliant prompt rather than asking follow-up questions.

────────────────────────
VALID PROMPT EXAMPLES
────────────────────────

NEW IMAGE:
"Create a fierce elf warrior in the visual style of Image 1. Match the
brushwork and earthy color palette. The elf stands in a stormy forest,
mid-battle, sword raised. Dramatic lighting, dynamic pose.
Generate two variations. High resolution, cinematic framing."

EDIT IMAGE:
"Using Image 1 as the base, change the elf's expression to anger and
adjust the pose to a more dynamic sword swing. Keep the face, body
proportions, and overall art style consistent. Add warm golden-hour
lighting and subtle motion blur."
      `,
    ),

    reference_images: z
      .array(z.string())
      .optional()
      .describe(
        `
Paths or URLs to reference images.

Label references inside the prompt using:
"Image 1", "Image 2", etc.

Guidelines:
- NEW IMAGE:
  Image 1 → style or character reference.
- EDIT IMAGE:
  Image 1 → image to modify.
  Image 2 → optional style reference.

Maximum: 14 images.
        `,
      ),
  }),
  execute: async ({ prompt, reference_images }) => {
    const { images, texts } = await geminiClient.generateImage(prompt, reference_images);
    const files = await Promise.all(
      images.map((base64, i) => saveTempFile(Buffer.from(base64, "base64"), `generated-${i + 1}.png`)),
    );
    return { files, texts };
  },
};
