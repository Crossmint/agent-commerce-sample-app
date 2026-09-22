"use client";

import { type ComponentType, useState } from "react";
import { MESSAGING_APP_META, MESSAGING_APPS, type MessagingApp } from "@/components/frame/views";
import { cn } from "@/lib/cn";
import { IMessageMock } from "./imessage-mock";
import { InstagramMock } from "./instagram-mock";
import { WhatsAppMock } from "./whatsapp-mock";

/*
 * One phone, three messaging apps. A small pill under the phone picks
 * iMessage, WhatsApp or Instagram; the thread is the same story in each.
 * Switching remounts the mock, so its timeline starts over.
 */

const MOCKS: Record<MessagingApp, ComponentType<{ className?: string }>> = {
  imessage: IMessageMock,
  whatsapp: WhatsAppMock,
  instagram: InstagramMock,
};

export function MessagingMock({
  className,
  initial = "imessage",
}: {
  className?: string;
  initial?: MessagingApp;
}) {
  const [app, setApp] = useState<MessagingApp>(initial);
  const Mock = MOCKS[app];
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <Mock key={app} className="w-full" />
      <div
        role="tablist"
        aria-label="Messaging app"
        className="inline-flex max-w-full gap-1 rounded-full bg-card/70 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5 backdrop-blur"
      >
        {MESSAGING_APPS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === app}
            onClick={() => setApp(id)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              id === app
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MESSAGING_APP_META[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
