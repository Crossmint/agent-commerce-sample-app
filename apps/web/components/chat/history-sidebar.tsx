"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { Button, Spinner, cn } from "@goat-wallet/ui";
import type { ChatSummary } from "@/lib/chat/types";

/**
 * Chat history, grouped by date. Server-rendered list; the client refreshes it
 * after each finished turn with `router.refresh()`.
 */
export function HistorySidebar({ chats, onNavigate }: { chats: ChatSummary[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeId = pathname?.startsWith("/chat/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;
  const groups = groupByDate(chats);

  return (
    <div className="flex h-full flex-col gap-3">
      <Button asChild variant="outline" size="sm" className="justify-start">
        <Link href="/chat" onClick={onNavigate}>
          <Plus /> New chat
        </Link>
      </Button>
      <nav className="-mx-1 flex-1 overflow-y-auto px-1" aria-label="Chat history">
        {chats.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">Your chats show up here.</p>
        ) : (
          groups.map(([label, items]) =>
            items.length ? (
              <div key={label} className="mb-4">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                <ul className="flex flex-col gap-0.5">
                  {items.map((chat) => (
                    <ChatItem key={chat.id} chat={chat} active={chat.id === activeId} onNavigate={onNavigate} />
                  ))}
                </ul>
              </div>
            ) : null,
          )
        )}
      </nav>
    </div>
  );
}

function ChatItem({ chat, active, onNavigate }: { chat: ChatSummary; active: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function remove() {
    start(async () => {
      await fetch(`/api/chat?id=${encodeURIComponent(chat.id)}`, { method: "DELETE" });
      if (active) router.push("/chat");
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-1 rounded-lg text-sm transition-colors hover:bg-accent",
        active && "bg-accent text-foreground",
      )}
    >
      <Link
        href={`/chat/${encodeURIComponent(chat.id)}`}
        onClick={onNavigate}
        className={cn("min-w-0 flex-1 truncate px-2 py-1.5", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}
        aria-current={active ? "page" : undefined}
      >
        {chat.title}
      </Link>
      {confirm ? (
        <div className="flex items-center gap-1 pr-1 text-xs">
          <button type="button" onClick={remove} disabled={pending} className="rounded px-1.5 py-1 text-destructive hover:bg-destructive/10">
            {pending ? <Spinner className="size-3" /> : "Delete"}
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="rounded px-1.5 py-1 text-muted-foreground hover:text-foreground">
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${chat.title}`}
          onClick={() => setConfirm(true)}
          className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  );
}

function groupByDate(chats: ChatSummary[]): Array<[string, ChatSummary[]]> {
  const now = new Date();
  const weekAgo = subWeeks(now, 1);
  const monthAgo = subMonths(now, 1);
  const today: ChatSummary[] = [];
  const yesterday: ChatSummary[] = [];
  const week: ChatSummary[] = [];
  const month: ChatSummary[] = [];
  const older: ChatSummary[] = [];
  for (const chat of chats) {
    const d = new Date(chat.updatedAt);
    if (isToday(d)) today.push(chat);
    else if (isYesterday(d)) yesterday.push(chat);
    else if (d > weekAgo) week.push(chat);
    else if (d > monthAgo) month.push(chat);
    else older.push(chat);
  }
  return [
    ["Today", today],
    ["Yesterday", yesterday],
    ["Last 7 days", week],
    ["Last 30 days", month],
    ["Older", older],
  ];
}
