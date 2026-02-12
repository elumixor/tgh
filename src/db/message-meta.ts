import { db, schema } from "db";
import { and, eq } from "drizzle-orm";

export async function upsertMessageExtra(chatId: number, messageId: number, extra: Record<string, unknown>) {
  const existing = await db
    .select({ extra: schema.messageMeta.extra })
    .from(schema.messageMeta)
    .where(and(eq(schema.messageMeta.chatId, chatId), eq(schema.messageMeta.messageId, messageId)))
    .get();

  const merged = { ...((existing?.extra as Record<string, unknown>) ?? {}), ...extra };

  if (existing) {
    await db
      .update(schema.messageMeta)
      .set({ extra: merged })
      .where(and(eq(schema.messageMeta.chatId, chatId), eq(schema.messageMeta.messageId, messageId)));
  } else {
    await db.insert(schema.messageMeta).values({ chatId, messageId, extra: merged });
  }
}
