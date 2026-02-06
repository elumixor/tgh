import { env } from "env";
import { gramjsClient } from "services/telegram";
import { defineTool } from "streaming-agent";
import { z } from "zod";

export const addToTelegramGroupTool = defineTool(
  "AddToTelegramGroup",
  "Add a user to the TGH team Telegram group by username. Attempts to add directly via Telegram API, falls back to invite link if that fails.",
  z.object({
    telegram_username: z
      .string()
      .describe("Telegram username (with or without @ prefix). Example: '@johndoe' or 'johndoe'"),
  }),
  async ({ telegram_username }, _context) => {
    const username = telegram_username.startsWith("@") ? telegram_username : `@${telegram_username}`;

    const result = await gramjsClient.addUserToGroup(env.TELEGRAM_TEAM_GROUP_ID, username);

    if (result.success) {
      return {
        success: true,
        message: `Successfully added ${username} to the team group`,
        username,
        group_id: env.TELEGRAM_TEAM_GROUP_ID,
      };
    }

    return {
      success: false,
      message: `Could not add ${username} directly (${result.error}). Please use invite link: ${env.TELEGRAM_TEAM_INVITE_LINK}`,
      invite_link: env.TELEGRAM_TEAM_INVITE_LINK,
      username,
      error: result.error,
    };
  },
);
