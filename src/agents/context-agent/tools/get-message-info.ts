import type { ToolDefinition } from "@agents/streaming-agent";
import { logger } from "logger";
import { gramjsClient } from "services/telegram";
import { z } from "zod";

export const getMessageInfoTool: ToolDefinition = {
  name: "get_message_info",
  description:
    "Get comprehensive information about a specific message: text, media (voice/photo/document), sender, date, reply relationships (replies to/from), and optionally transcribe voice messages. This is your primary tool for understanding message content and context.",
  parameters: z.object({
    message_id: z.number().describe("The ID of the message to get info for"),
    include_mentions: z
      .boolean()
      .optional()
      .describe("Include message mentions (replies to this message and message it replied to). Default: true"),
    transcribe_voice: z
      .boolean()
      .optional()
      .describe("If message contains voice, transcribe it using OpenAI Whisper. Default: false"),
  }),
  execute: async ({ message_id, include_mentions, transcribe_voice }) => {
    const includeMentions = include_mentions !== false;
    const transcribeVoice = transcribe_voice === true;

    logger.info({ messageId: message_id, includeMentions, transcribeVoice }, "Message info request received");

    const [messageInfo, mentions] = await Promise.all([
      gramjsClient.getMessageInfo(message_id),
      includeMentions ? gramjsClient.getMessageMentions(message_id) : Promise.resolve(undefined),
    ]);

    const result: Record<string, unknown> = { ...messageInfo };

    if (mentions) {
      result.replied_to = mentions.repliedTo;
      result.replies = mentions.replies;
    }

    if (transcribeVoice && messageInfo.voice) {
      // Voice transcription temporarily disabled - requires Telegram bot context
    }

    logger.info(
      {
        messageId: message_id,
        hasVoice: !!messageInfo.voice,
        hasMentions: !!mentions,
        transcribed: !!result.voice_transcription,
      },
      "Message info retrieved",
    );
    return result;
  },
};
