import OpenAI from "openai";
import { env } from "../env";
import { logger } from "../logger";
import type { Tool, ToolContext } from "./types";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const transcribeVoiceTool: Tool = {
  definition: {
    name: "transcribe_voice",
    description:
      "Transcribe a voice message to text using OpenAI Whisper. Provide the message ID containing the voice message.",
    input_schema: {
      type: "object",
      properties: {
        message_id: {
          type: "number",
          description: "The message ID containing the voice message to transcribe",
        },
      },
      required: ["message_id"],
    },
  },
  execute: async (toolInput, context?: ToolContext) => {
    const messageId = toolInput.message_id as number;
    logger.info({ messageId }, "Voice transcription request received");

    if (!context?.telegramCtx) return { success: false, error: "No Telegram context available" };

    try {
      const bot = context.telegramCtx.api;
      const msg = await bot.forwardMessage(env.ALLOWED_CHAT_ID, env.ALLOWED_CHAT_ID, messageId);

      if (!msg.voice) return { success: false, error: "Message does not contain a voice message" };

      const fileLink = await bot.getFile(msg.voice.file_id);
      const voiceUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;

      const response = await fetch(voiceUrl);
      const buffer = await response.arrayBuffer();

      const file = new File([buffer], "voice.ogg", { type: "audio/ogg" });

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
      });

      await bot.deleteMessage(env.ALLOWED_CHAT_ID, msg.message_id);

      logger.info({ messageId, transcriptionLength: transcription.text.length }, "Voice transcribed successfully");
      return { success: true, transcription: transcription.text };
    } catch (error) {
      logger.error({ messageId, error: error instanceof Error ? error.message : error }, "Voice transcription failed");
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
};
