import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText } from "ai";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { chatEnabled, chatModel } from "@/lib/chat/config";
import { apiClient } from "@/lib/chat/api-client";
import { systemPrompt } from "@/lib/chat/prompt";
import { createChatTools } from "@/lib/chat/tools";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { createChat, deleteChat, getChat, touchChat, upsertMessage } from "@/lib/db/queries";

/**
 * POST /api/chat: one model turn, streamed as AI SDK UI message chunks.
 *
 * The client always sends the whole conversation. With DATABASE_URL set, the
 * route persists the chat and every message; without it, nothing is stored and
 * the client's copy is the only copy. The tools call the Agent Commerce handlers in
 * process with the user's session JWT (see lib/chat/tools.ts for the
 * human-in-the-loop pattern behind `await_agent_card_approval`).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  id: z.string().min(1).max(64),
  messages: z.array(z.unknown()).min(1).max(400),
});

function error(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  if (!chatEnabled()) return error(501, "Chat is off. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.");

  const session = await getSession();
  if (!session) return error(401, "Not signed in.");

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(400, "Bad request body.");
  const { id: chatId } = parsed.data;

  const api = apiClient(session.sessionJwt);
  const tools = createChatTools(api, { userEmail: session.email });

  const validated = await safeValidateUIMessages<ChatMessage>({ messages: parsed.data.messages, tools });
  if (!validated.success) return error(400, `Bad messages: ${validated.error.message}`);
  const messages = validated.data;
  const last = messages.at(-1);
  if (!last || (last.role !== "user" && last.role !== "assistant")) return error(400, "Bad messages.");

  // Persistence, when a database is configured.
  const db = getDb();
  if (db) {
    const chat = await getChat(db, chatId);
    if (chat && chat.userId !== session.userId) return error(403, "Not your chat.");
    if (!chat) {
      const firstUser = messages.find((m) => m.role === "user");
      await createChat(db, { id: chatId, userId: session.userId, title: titleFrom(firstUser) });
    }
    // The last message is either the new user turn, or the assistant turn the
    // client finished (a tool output was added). Store it as the client has it.
    await upsertMessage(db, { id: last.id, chatId, role: last.role, parts: last.parts });
  }

  const result = streamText({
    model: chatModel(),
    instructions: systemPrompt({ userEmail: session.email, buyerProfile: await savedDetails(api) }),
    messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
    tools,
    stopWhen: stepCountIs(8),
    onError: ({ error: err }) => console.error("[chat] stream error", err),
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    originalMessages: messages,
    generateMessageId: () => nanoid(),
    onError: (err) => (err instanceof Error ? err.message : "Something went wrong."),
    onEnd: async ({ responseMessage }) => {
      if (!db) return;
      try {
        await upsertMessage(db, {
          id: responseMessage.id,
          chatId,
          role: responseMessage.role,
          parts: responseMessage.parts,
        });
        await touchChat(db, chatId);
      } catch (e) {
        console.error("[chat] failed to save assistant message", e);
      }
    },
  });
}

/** DELETE /api/chat?id=<chatId>: remove a chat and its messages. */
export async function DELETE(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return error(401, "Not signed in.");
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return error(400, "Missing id.");
  const db = getDb();
  if (!db) return error(501, "No database. Set DATABASE_URL to keep chat history.");
  const ok = await deleteChat(db, id, session.userId);
  return ok ? new Response(null, { status: 204 }) : error(404, "No such chat.");
}

/** The user's saved buyer details, for the prompt. None is fine: the chat works without. */
async function savedDetails(api: ReturnType<typeof apiClient>) {
  try {
    return (await api.getBuyerProfile()) ?? undefined;
  } catch (e) {
    console.warn("[chat] could not read the buyer profile", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** A title from the first user message: its first line, cut to 60 characters. */
function titleFrom(message: ChatMessage | undefined): string {
  const text = message?.parts
    .filter((p): p is Extract<ChatMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim()
    .split("\n")[0];
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}
