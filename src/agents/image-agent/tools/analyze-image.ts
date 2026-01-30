import type { ToolDefinition } from "@agents/streaming-agent";
import { geminiClient } from "services/gemini/gemini";
import { z } from "zod";

export const analyzeImageTool: ToolDefinition = {
  name: "analyze_image",
  description:
    "Analyze one or more images using Gemini Nano Banana. The tool converts a user question into a structured visual-analysis prompt that guides accurate image understanding, reasoning, and description. Returns { texts: string[] }.",
  parameters: z.object({
    task: z.string().describe(
      `
PURPOSE
Transform a user request into a clear, structured prompt for image analysis.

The task may involve:
- visual description
- object or attribute identification
- comparison between images
- spatial reasoning
- critique or evaluation
- factual inference based strictly on visible evidence

────────────────────────
MUST (Required)
────────────────────────
1. Rewrite the task as explicit analysis instructions.
2. Reference images clearly using:
   "Image 1", "Image 2", etc.
3. Specify the type of analysis required:
   (describe, identify, compare, explain, evaluate).
4. Ground all conclusions strictly in visible evidence.

───────────────────────
SHOULD (Strongly Recommended)
────────────────────────
- Break complex analysis into ordered steps.
- Call out specific visual elements to inspect:
  objects, colors, materials, expressions, lighting,
  text, composition, spatial relationships.
- If uncertainty exists, state it explicitly.

────────────────────────
OPTIONAL (If Useful)
────────────────────────
- Request structured output (bullet points, sections).
- Ask for confidence levels or alternative interpretations.
- Limit the scope (e.g., "ignore background", "focus on hands").

────────────────────────
SAFETY & ACCURACY
────────────────────────
- Do NOT guess intent, identity, or hidden context.
- Do NOT infer sensitive attributes.
- If the task cannot be answered from the image alone,
  say so explicitly.

────────────────────────
BEHAVIOR
────────────────────────
If the user task is vague or underspecified, infer the
most likely analytical intent and expand it into a
compliant prompt instead of asking questions.

────────────────────────
VALID PROMPT EXAMPLES
────────────────────────

GENERAL DESCRIPTION:
"Analyze Image 1 and describe the scene in detail. Identify
the main subjects, their actions, the environment, and
notable visual details. Structure the response in sections."

OBJECT IDENTIFICATION:
"Using Image 1, identify all visible objects on the table.
Describe their shape, material, color, and relative position."

COMPARISON:
"Compare Image 1 and Image 2. Focus on differences in
lighting, composition, subject posture, and emotional tone."

CRITIQUE:
"Analyze Image 1 as a piece of concept art. Evaluate
composition, color harmony, focal points, and readability."

REASONING:
"Using Image 1, explain what is happening in the scene.
Base the explanation strictly on visible evidence and
avoid speculation."
      `,
    ),

    images: z
      .array(z.string())
      .min(1)
      .describe(
        `
Paths or URLs of images to analyze.

Rules:
- At least one image is required.
- Label references in the task prompt as:
  "Image 1", "Image 2", etc.
- Maximum: 14 images.
        `,
      ),
  }),
  execute: async ({ task, images }) => geminiClient.analyzeImage(task, images),
};
