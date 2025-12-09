import { env } from "env";
import type { Bot } from "grammy";

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getPhotoUrl(fileId: string, bot: Bot): Promise<string> {
  const fileLink = await bot.api.getFile(fileId);
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${fileLink.file_path}`;
}
