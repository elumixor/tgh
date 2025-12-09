import type { Tool, ToolContext } from "agents/agent";
import { env } from "env";
import { logger } from "logger";
import OpenAI from "openai";
import { gramjsClient } from "services/telegram";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const getMessageInfoTool: Tool = {
  definition: {
    name: "get_message_info",
    description:
      "Get comprehensive information about a specific message: text, media (voice/photo/document), sender, date, reply relationships (replies to/from), and optionally transcribe voice messages. This is your primary tool for understanding message content and context.",
    input_schema: {
      type: "object",
      properties: {
        message_id: {
          type: "number",
          description: "The ID of the message to get info for",
        },
        include_mentions: {
          type: "boolean",
          description: "Include message mentions (replies to this message and message it replied to). Default: true",
        },
        transcribe_voice: {
          type: "boolean",
          description: "If message contains voice, transcribe it using OpenAI Whisper. Default: false",
        },
      },
      required: ["message_id"],
    },
  },
  execute: async (toolInput, context?: ToolContext) => {
    const messageId = toolInput.message_id as number;
    const includeMentions = toolInput.include_mentions !== false;
    const transcribeVoice = toolInput.transcribe_voice === true;

    logger.info({ messageId, includeMentions, transcribeVoice }, "Message info request received");

    try {
      const [messageInfo, mentions] = await Promise.all([
        gramjsClient.getMessageInfo(messageId),
        includeMentions ? gramjsClient.getMessageMentions(messageId) : Promise.resolve(undefined),
      ]);

      const result: Record<string, unknown> = {
        success: true,
        ...messageInfo,
      };

      if (mentions) {
        result.replied_to = mentions.repliedTo;
        result.replies = mentions.replies;
      }

      if (transcribeVoice && messageInfo.voice && context?.telegramCtx) {
        try {
          const bot = context.telegramCtx.api;
          const msg = await bot.forwardMessage(env.ALLOWED_CHAT_ID, env.ALLOWED_CHAT_ID, messageId);

          if (msg.voice) {
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

            result.voice_transcription = transcription.text;
            logger.info({ messageId, transcriptionLength: transcription.text.length }, "Voice transcribed");
          }
        } catch (error) {
          logger.error(
            { messageId, error: error instanceof Error ? error.message : error },
            "Voice transcription failed",
          );
          result.transcription_error = error instanceof Error ? error.message : "Unknown error";
        }
      }

      logger.info(
        {
          messageId,
          hasVoice: !!messageInfo.voice,
          hasMentions: !!mentions,
          transcribed: !!result.voice_transcription,
        },
        "Message info retrieved",
      );
      return result;
    } catch (error) {
      logger.error({ messageId, error: error instanceof Error ? error.message : error }, "Failed to get message info");
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
};
