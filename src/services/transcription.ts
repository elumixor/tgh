import { env } from "env";
import type { Api } from "grammy";
import { logger } from "logger";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

/**
 * Transcribe a voice message using OpenAI Whisper
 * @param api Grammy bot API
 * @param fileId Telegram file ID of the voice message
 * @returns Transcribed text, or undefined if transcription fails
 */
export async function transcribeVoice(api: Api, fileId: string): Promise<string | undefined> {
  try {
    const fileLink = await api.getFile(fileId);
    if (!fileLink.file_path) {
      logger.warn({ fileId }, "Voice file has no file_path");
      return undefined;
    }

    const voiceUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;

    const response = await fetch(voiceUrl);
    const buffer = await response.arrayBuffer();
    const file = new File([buffer], "voice.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    logger.info({ fileId, transcriptionLength: transcription.text.length }, "Voice transcribed");
    return transcription.text;
  } catch (error) {
    logger.error({ fileId, error: error instanceof Error ? error.message : error }, "Voice transcription failed");
    return undefined;
  }
}
