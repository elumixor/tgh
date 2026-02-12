import { GoogleGenAI } from "@google/genai";
import { env } from "env";
import { readFile } from "utils";

/**
 * Generate/edit, or analyze images using Google Gemini API
 */
export class GeminiClient {
  private readonly client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  private readonly model = "gemini-2.5-flash-image";

  async generateImage(prompt: string, references: string[] = []) {
    const refParts = await Promise.all(references.map((url) => this.toInlinePart(url)));

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [...refParts, { text: prompt }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const images = parts.map((part) => part.inlineData?.data).filter((image): image is string => !!image);
    const texts = parts.map((part) => part.text).filter((text): text is string => !!text);
    return { images, texts };
  }

  async analyzeImage(task: string, images: string[]) {
    const refParts = await Promise.all(images.map((url) => this.toInlinePart(url)));

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [...refParts, { text: task }],
      config: { responseModalities: ["TEXT"] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const texts = parts.map((part) => part.text).filter((text): text is string => !!text);
    return { texts };
  }

  private async toInlinePart(url: string): Promise<{ inlineData: { mimeType: string; data: string } }> {
    const { buffer, mimeType } = await readFile(url);
    return { inlineData: { mimeType, data: buffer.toString("base64") } };
  }
}

export const geminiClient = new GeminiClient();
