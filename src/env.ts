import { z } from "zod";

const envSchema = z
  .object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
    ALLOWED_USER_ID: z.coerce.number(),
    ALLOWED_CHAT_ID: z.coerce.number(),

    BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
    PORT: z.coerce.number(),
    BASE_URL: z.string(),

    // Required API keys
    MESHY_API_KEY: z.string().min(1, "MESHY_API_KEY is required"),
    GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
    PERPLEXITY_API_KEY: z.string().min(1, "PERPLEXITY_API_KEY is required"),
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

    // Notion Integration
    NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
    NOTION_DATABASE_ID: z.string().min(1, "NOTION_DATABASE_ID is required"),

    // Telegram User Client (GramJS)
    TELEGRAM_API_ID: z.coerce.number(),
    TELEGRAM_API_HASH: z.string().min(1, "TELEGRAM_API_HASH is required"),
    TELEGRAM_SESSION: z.string().min(1, "TELEGRAM_SESSION is required"),
    TELEGRAM_SESSION_LOCAL: z.string().optional(),
    TELEGRAM_PHONE_NUMBER: z.string().min(1, "TELEGRAM_PHONE_NUMBER is required"),

    // Google Drive
    GOOGLE_DRIVE_CREDENTIALS: z.string().min(1, "GOOGLE_DRIVE_CREDENTIALS is required"),

    VERBOSE: z.number().default(0),
  })
  .refine((data) => data.BOT_MODE !== "webhook" || data.BASE_URL, {
    message: "WEBHOOK_URL is required when BOT_MODE is 'webhook'",
    path: ["WEBHOOK_URL"],
  });

// Parse and validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
