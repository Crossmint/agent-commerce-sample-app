import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { getSession } from "@/lib/auth";
import { attachmentsEnabled } from "@/lib/chat/config";
import type { ChatMessage } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { getChat, getMessages } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Chat" };

/**
 * An existing chat. With a database, loads the messages the user owns.
 * Without one, the id is only a name for this tab's chat.
 */
export default async function ChatByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  let initialMessages: ChatMessage[] = [];

  if (db) {
    const session = await getSession();
    const chat = await getChat(db, id);
    if (!chat || !session || chat.userId !== session.userId) notFound();
    initialMessages = (await getMessages(db, id)).map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts as ChatMessage["parts"],
    }));
  }

  return <Chat key={id} id={id} initialMessages={initialMessages} persist={Boolean(db)} attachmentsEnabled={attachmentsEnabled()} />;
}
