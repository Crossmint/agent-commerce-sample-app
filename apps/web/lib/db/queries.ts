import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./index";
import { type Chat, chatMessages, chats, chatVotes, type DBMessage, type Vote } from "./schema";

/**
 * Chat persistence. Every function takes the db so callers decide whether a
 * database exists (see `getDb`). Ownership checks live here: a chat is only
 * ever read or changed by the Stytch user that created it.
 */

export async function getChat(db: Db, id: string): Promise<Chat | null> {
  const [row] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return row ?? null;
}

export async function listChats(db: Db, userId: string, limit = 100): Promise<Chat[]> {
  return db.select().from(chats).where(eq(chats.userId, userId)).orderBy(desc(chats.updatedAt)).limit(limit);
}

export async function createChat(db: Db, input: { id: string; userId: string; title: string }): Promise<void> {
  await db.insert(chats).values(input).onConflictDoNothing();
}

export async function touchChat(db: Db, id: string): Promise<void> {
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, id));
}

export async function deleteChat(db: Db, id: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, id), eq(chats.userId, userId)))
    .returning({ id: chats.id });
  return deleted.length > 0;
}

export async function getMessages(db: Db, chatId: string): Promise<DBMessage[]> {
  return db.select().from(chatMessages).where(eq(chatMessages.chatId, chatId)).orderBy(asc(chatMessages.createdAt));
}

/**
 * Insert or replace a message by id. Tool results and continued assistant
 * messages arrive as updates to a message the client already has, so parts are
 * always replaced as a whole.
 */
export async function upsertMessage(
  db: Db,
  input: { id: string; chatId: string; role: DBMessage["role"]; parts: unknown[] },
): Promise<void> {
  await db
    .insert(chatMessages)
    .values(input)
    .onConflictDoUpdate({ target: chatMessages.id, set: { parts: input.parts } });
}

export async function getVotes(db: Db, chatId: string): Promise<Vote[]> {
  return db.select().from(chatVotes).where(eq(chatVotes.chatId, chatId));
}

export async function voteMessage(
  db: Db,
  input: { chatId: string; messageId: string; isUpvoted: boolean },
): Promise<void> {
  await db
    .insert(chatVotes)
    .values(input)
    .onConflictDoUpdate({
      target: [chatVotes.chatId, chatVotes.messageId],
      set: { isUpvoted: sql`excluded.is_upvoted` },
    });
}
