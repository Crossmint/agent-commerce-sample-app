import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { EmptyState } from "@goat-wallet/ui";
import { ChatShell } from "@/components/chat/chat-shell";
import { HistorySidebar } from "@/components/chat/history-sidebar";
import { Nav } from "@/components/nav";
import { getSession } from "@/lib/auth";
import { chatEnabled } from "@/lib/chat/config";
import type { ChatSummary } from "@/lib/chat/types";
import { getDb } from "@/lib/db";
import { listChats } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * The chat half. Needs a signed-in user, like the wallet pages. With a
 * database, the left column lists the user's chats. Without one, there is a
 * single chat that lives in the browser tab.
 */
export default async function ChatLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fchat");

  const enabled = chatEnabled();
  const nav = <Nav email={session.email} chatEnabled={enabled} />;

  if (!enabled) {
    return (
      <div className="flex flex-1 flex-col">
        {nav}
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
          <EmptyState
            title="Chat is off"
            description="Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your env to turn on the agent chat. See .env.example."
          />
        </main>
      </div>
    );
  }

  let chats: ChatSummary[] | undefined;
  const db = getDb();
  if (db) {
    try {
      chats = (await listChats(db, session.userId)).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
    } catch (e) {
      console.error("[chat] could not list chats", e);
      chats = [];
    }
  }

  // One root element, as in the wallet layout: the router scrolls the new
  // page into view and must not land on the last of several roots.
  return (
    <div className="flex flex-1 flex-col">
      {nav}
      <ChatShell sidebar={chats ? <HistorySidebar chats={chats} /> : undefined}>{children}</ChatShell>
    </div>
  );
}
