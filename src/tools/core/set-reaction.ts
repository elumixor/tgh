import type { ReactionTypeEmoji } from "@grammyjs/types";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const setReactionTool = defineTool(
  "SetReaction",
  "Set a reaction emoji on the user's message, replacing any current reaction. Common uses: 👍 (done), 🔥 (success), 👀 (looking), 😢 (error), 🤔 (warning), 🎉 (celebration). Only standard Telegram reaction emojis are supported.",
  z.object({
    emoji: z.string().describe("Telegram reaction emoji"),
  }),
  async ({ emoji }, job) => {
    const chatId = job.telegramContext.chat?.id;
    if (!chatId) return "No chat context available";

    await job.telegramContext.api.setMessageReaction(chatId, job.messageId, [
      { type: "emoji", emoji: emoji as ReactionTypeEmoji["emoji"] },
    ]);
    return `Reaction "${emoji}" set`;
  },
);
