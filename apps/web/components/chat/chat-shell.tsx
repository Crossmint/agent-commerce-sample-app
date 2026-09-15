"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { History, X } from "lucide-react";
import { Button, cn } from "@goat-wallet/ui";

/**
 * Two columns under the nav: history on the left, the chat on the right.
 * The nav is 4rem tall, so the shell takes the rest of the viewport and the
 * message list scrolls inside it. On small screens the history is a drawer.
 */
export function ChatShell({ sidebar, children }: { sidebar?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Navigating to a chat closes the drawer. State adjusts during render, no effect needed.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full">
      {sidebar ? (
        <>
          <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 p-3 md:block">{sidebar}</aside>
          <div className={cn("fixed inset-0 z-30 md:hidden", open ? "" : "pointer-events-none")}>
            <button
              type="button"
              aria-label="Close history"
              onClick={() => setOpen(false)}
              className={cn("absolute inset-0 bg-background/70 transition-opacity", open ? "opacity-100" : "opacity-0")}
            />
            <aside
              className={cn(
                "absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-background p-3 shadow-xl transition-transform",
                open ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">History</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X />
                </Button>
              </div>
              <div className="min-h-0 flex-1">{sidebar}</div>
            </aside>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed bottom-24 left-3 z-20 md:hidden"
            aria-label="Open history"
            onClick={() => setOpen(true)}
          >
            <History />
          </Button>
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
