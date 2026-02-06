import { models } from "models";
import OpenAI from "openai";
import { memories } from "services/memories";
import { defineTool } from "streaming-agent";
import { z } from "zod";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are a memory manager. You receive the current memories content and an instruction on how to update it.

Output ONLY the updated memories content - no explanations, no markdown code blocks, just the raw content.

Keep memories organized as bullet points. Be concise.`;

export const updateMemoriesTool = defineTool(
  "UpdateMemories",
  "Update memories based on instruction. Use when user provides feedback about preferences or asks to remember something.",
  z.object({
    instruction: z.string().describe("What to add, remove, or change in the memories"),
  }),
  async ({ instruction }) => {
    const currentMemories = memories.get();

    const response = await openai.chat.completions.create({
      model: models.mini,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Current memories:\n${currentMemories || "(empty)"}\n\nInstruction: ${instruction}`,
        },
      ],
    });

    const newMemories = response.choices[0]?.message?.content?.trim() ?? currentMemories;
    memories.save(newMemories);

    return { success: true, memories: newMemories };
  },
);
