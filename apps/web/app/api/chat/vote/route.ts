import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb, type Db } from "@/lib/db";
import { getChat, getVotes, voteMessage } from "@/lib/db/queries";

/** Thumbs up or down on an assistant message. Only with a database. */
export const dynamic = "force-dynamic";

function error(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

type Owned = { ok: true; db: Db } | { ok: false; response: Response };

async function ownedChat(chatId: string): Promise<Owned> {
  const session = await getSession();
  if (!session) return { ok: false, response: error(401, "Not signed in.") };
  const db = getDb();
  if (!db) return { ok: false, response: error(501, "No database.") };
  const chat = await getChat(db, chatId);
  if (!chat || chat.userId !== session.userId) return { ok: false, response: error(404, "No such chat.") };
  return { ok: true, db };
}

export async function GET(req: Request): Promise<Response> {
  const chatId = new URL(req.url).searchParams.get("chatId");
  if (!chatId) return error(400, "Missing chatId.");
  const r = await ownedChat(chatId);
  if (!r.ok) return r.response;
  return Response.json({ votes: await getVotes(r.db, chatId) });
}

const voteSchema = z.object({ chatId: z.string().min(1), messageId: z.string().min(1), isUpvoted: z.boolean() });

export async function PATCH(req: Request): Promise<Response> {
  const parsed = voteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(400, "Bad request body.");
  const r = await ownedChat(parsed.data.chatId);
  if (!r.ok) return r.response;
  await voteMessage(r.db, parsed.data);
  return new Response(null, { status: 204 });
}
