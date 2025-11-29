import { z } from "zod";

const envSchema = z.object({
  // Required
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ALLOWED_USER_ID: z.coerce.number(),
  ALLOWED_CHAT_ID: z.coerce.number(),

  // Optional with defaults
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  PORT: z.coerce.number().default(10000),

  // Optional
  WEBHOOK_URL: z.string().optional(),

  // Required API keys
  MESHY_API_KEY: z.string().min(1, "MESHY_API_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
});

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
