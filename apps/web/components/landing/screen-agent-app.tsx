"use client";

import type { ReactNode } from "react";
import { ArrowUp, CircleCheck, CreditCard, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useThreadScroll } from "./chat/use-follow-latest";

/*
 * The agent app's own phone screen, as `components/experiences/mobile-app.tsx`
 * draws it for real. The landing needs a still copy of it, so this file keeps
 * the same bones and none of the state:
 *
 * - a "Chat" title with the Cards and Account round buttons beside it;
 * - the user's messages in primary bubbles, the agent's replies as plain text
 *   on the canvas with no bubble at all, and each tool run as one small line
 *   with a check;
 * - cards (an approval, a checkout, a receipt) on the theme's own card
 *   surface, 16px corners and a hairline ring;
 * - a pill composer that reads "Ask the agent to buy something".
 *
 * Every measure is a share of the real screen's, scaled down for a 320px
 * phone: the real app sets 15px body text on a 393px screen.
 */

/** One entry in the mock thread. */
export type AppEntry =
  | { kind: "user"; key: string; text: ReactNode }
  | { kind: "agent"; key: string; text: ReactNode }
  | { kind: "activity"; key: string; label: ReactNode }
  | { kind: "card"; key: string; node: ReactNode };

export function AgentAppScreen({
  entries,
  initial = "A",
  className,
}: {
  entries: AppEntry[];
  /** The letter on the Account button, as the real app shows the user's initial. */
  initial?: string;
  className?: string;
}) {
  const thread = useThreadScroll<HTMLDivElement>({ mode: "bottom", dep: entries.length });
  return (
    <div className={cn("flex h-full flex-col bg-background text-foreground", className)}>
      <div className="flex items-center gap-2 px-4 pt-11 pb-1">
        <h2 className="flex-1 text-[19px] leading-[1.2] font-medium tracking-[-0.02em]">Chat</h2>
        <RoundButton>
          <CreditCard className="size-[15px]" strokeWidth={2} />
        </RoundButton>
        <RoundButton>
          <span className="text-[11px] font-semibold text-primary">{initial}</span>
        </RoundButton>
      </div>
      <div ref={thread} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mt-auto flex flex-col gap-2 px-4 py-3">
          {entries.map((e) => (
            <div key={e.key} className="landing-bubble flex flex-col">
              <Entry entry={e} />
            </div>
          ))}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function RoundButton({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
    >
      {children}
    </span>
  );
}

function Entry({ entry }: { entry: AppEntry }) {
  switch (entry.kind) {
    case "user":
      return (
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[12.5px] leading-snug text-primary-foreground">
          {entry.text}
        </div>
      );
    /* The real app's AgentBubble: grey, its tail corner at the bottom left. */
    case "agent":
      return (
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3 py-[7px] text-[12.5px] leading-snug text-foreground">
          {entry.text}
        </p>
      );
    /* The real app's ActivityLine: a check in the success color, then the label. */
    case "activity":
      return (
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <CircleCheck className="size-3 shrink-0 text-success" strokeWidth={2.2} />
          <span className="truncate">{entry.label}</span>
        </p>
      );
    case "card":
      return <div className="w-full">{entry.node}</div>;
  }
}

function Composer() {
  return (
    <div aria-hidden className="shrink-0 px-3.5 pt-1.5 pb-6">
      <div className="flex h-9 items-center gap-2 rounded-full bg-muted pr-1 pl-3.5">
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
          Ask the agent to buy something
        </span>
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ArrowUp className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

/**
 * The app's bottom sheet, the shell `PhoneSheet` gives the real approval: a
 * 2rem top corner and a round close button. Driven by `data-open`, so it can
 * come and go over a thread that stays put.
 */
export function AppSheet({
  open,
  title,
  children,
}: {
  open: boolean;
  /** The sheet's name, for assistive tech. The body carries the heading. */
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div
        aria-hidden
        data-open={open}
        className="landing-scrim-toggle absolute inset-0 z-30 bg-black/10"
      />
      <div
        data-open={open}
        aria-hidden={!open}
        className="landing-sheet-toggle absolute inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[2rem] bg-popover text-popover-foreground shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.15)]"
      >
        {/*
          No visible title: the body opens with its own heading, and once the
          request is allowed the sheet read "Approve", a tick, then
          "Approved." — three headings for one outcome.
        */}
        <div className="flex shrink-0 items-start justify-end px-4 pt-4 pb-1">
          <span className="sr-only">{title}</span>
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-6">{children}</div>
      </div>
    </>
  );
}
