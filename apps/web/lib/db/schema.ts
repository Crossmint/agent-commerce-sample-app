/**
 * Postgres schema for the chat half, adapted from the Vercel AI Chatbot template.
 * Users are not stored here: `user_id` is the Stytch user id from the session.
 *
 * Agent Commerce's own tables (agent card requests, checkout links) come from
 * `@agent-commerce/server/drizzle`. drizzle.config.ts lists that file next to this
 * one, so one `db:push` creates everything. This file does not import it:
 * drizzle-kit resolves imports with Node's CommonJS resolver, and the server
 * package only exports an `import` condition for `./drizzle`.
 */
import type { InferSelectModel } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const tz = { withTimezone: true, mode: "date" } as const;

export const chats = pgTable(
  "chats",
  {
    id: text("id").primaryKey(),
    /** Stytch user id. */
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
  },
  (t) => [index("chats_user_id_updated_at_idx").on(t.userId, t.updatedAt)],
);

export type Chat = InferSelectModel<typeof chats>;

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    /** AI SDK UI message parts, as sent to the client. Tool parts carry their inputs and outputs. */
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_chat_id_created_at_idx").on(t.chatId, t.createdAt)],
);

export type DBMessage = InferSelectModel<typeof chatMessages>;

export const chatVotes = pgTable(
  "chat_votes",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    isUpvoted: boolean("is_upvoted").notNull(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.messageId] })],
);

export type Vote = InferSelectModel<typeof chatVotes>;
