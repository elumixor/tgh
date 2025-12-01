import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { z } from "zod";

const loginEnvSchema = z.object({
  TELEGRAM_API_ID: z.coerce.number(),
  TELEGRAM_API_HASH: z.string().min(1, "TELEGRAM_API_HASH is required"),
  TELEGRAM_PHONE_NUMBER: z.string().min(1, "TELEGRAM_PHONE_NUMBER is required"),
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const envPath = path.join(process.cwd(), ".env");

  // Parse and validate environment variables
  const parsed = loginEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Missing required environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    console.error("\nMake sure your .env file contains:");
    console.error("  TELEGRAM_API_ID=...");
    console.error("  TELEGRAM_API_HASH=...");
    console.error("  TELEGRAM_PHONE_NUMBER=...");
    console.error("\nGet API credentials from https://my.telegram.org/apps");
    process.exit(1);
  }

  const { TELEGRAM_API_ID: apiId, TELEGRAM_API_HASH: apiHash, TELEGRAM_PHONE_NUMBER: phoneNumber } = parsed.data;

  console.log(`Logging in with phone: ${phoneNumber}`);

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () => await rl.question("Password (if 2FA enabled): "),
    phoneCode: async () => await rl.question("Enter code from Telegram: "),
    onError: (err) => console.error(err),
  });

  const sessionString = String(client.session.save());
  console.log("\n✅ Login successful!");

  // Update .env file
  const envContent = fs.readFileSync(envPath, "utf-8");
  const sessionLine = `TELEGRAM_SESSION="${sessionString}"`;
  const lines = envContent.split("\n");
  const sessionIndex = lines.findIndex((line: string) => line.startsWith("TELEGRAM_SESSION="));

  if (sessionIndex !== -1) {
    lines[sessionIndex] = sessionLine;
    console.log("Replaced existing TELEGRAM_SESSION in .env");
  } else {
    lines.push(sessionLine);
    console.log("Added TELEGRAM_SESSION to .env");
  }

  fs.writeFileSync(envPath, lines.join("\n"));

  await client.disconnect();
  rl.close();
  console.log("\n✅ Session saved to .env");
}

main().catch(console.error);
