import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messageMeta = sqliteTable(
  "message_meta",
  {
    chatId: integer("chat_id").notNull(),
    messageId: integer("message_id").notNull(),
    transcription: text("transcription"),
    skillContext: text("skill_context", { mode: "json" }),
    waitingState: text("waiting_state"),
    extra: text("extra", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })],
);
