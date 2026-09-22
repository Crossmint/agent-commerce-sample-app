import { getSession } from "@/lib/auth";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { getChat, getMessages } from "@/lib/db/queries";

/**
 * GET /api/chat/history/<id>: the messages of one saved chat, for the app
 * page to open a conversation without leaving the frame. Only the owner gets
 * them; anyone else sees the same 404 as a chat that does not exist.
 */
export const dynamic = "force-dynamic";

function error(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return error(401, "Not signed in.");
  const db = getDb();
  if (!db) return error(501, "No database. Set DATABASE_URL to keep chat history.");
  const { id } = await ctx.params;
  const chat = await getChat(db, id);
  if (!chat || chat.userId !== session.userId) return error(404, "No such chat.");
  const messages: ChatMessage[] = (await getMessages(db, id)).map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts as ChatMessage["parts"],
  }));
  return Response.json({ messages });
}
