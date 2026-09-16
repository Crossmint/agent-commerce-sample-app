"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { useInView } from "./use-in-view";

export type ThreadVariant = "full" | "request" | "confirmation";

export interface MessageThreadMockProps {
  /** Name in the thread header. Default "GOAT". */
  agentName?: string;
  /** Avatar in the header. Default: the goat mark. */
  agentAvatar?: ReactNode;
  /** Which part of the story to show. Default "full". */
  variant?: ThreadVariant;
  /** "phone" draws a handset around the thread. "plain" is just the thread. */
  frame?: "phone" | "plain";
  className?: string;
}

interface Bubble {
  key: string;
  node: ReactNode;
  /** ms after the thread enters view. */
  at: number;
}

/**
 * An iMessage-style thread: the user asks, the agent asks for a budget, the
 * user approves, the agent sends the receipt. Bubbles appear in sequence and
 * the sequence restarts each time the thread scrolls back into view.
 */
export function MessageThreadMock({
  agentName = "GOAT",
  agentAvatar,
  variant = "full",
  frame = "phone",
  className,
}: MessageThreadMockProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  // Remounting the bubbles restarts their CSS animations. The first run starts
  // on page load; later runs start on re-entry.
  const [run, setRun] = useState(0);
  const wasOut = useRef(false);
  useEffect(() => {
    if (inView === false) wasOut.current = true;
    if (inView === true && wasOut.current) {
      wasOut.current = false;
      setRun((r) => r + 1);
    }
  }, [inView]);

  const bubbles = script(variant);
  const thread = (
    <div ref={ref} className={cn("flex flex-col bg-background text-foreground", frame === "phone" ? "" : "")}>
      <ThreadHeader agentName={agentName} avatar={agentAvatar} />
      <div key={run} className="flex flex-col gap-2.5 px-3.5 pt-3 pb-4">
        {bubbles.map((b) => (
          <div key={b.key} className="landing-bubble flex flex-col" style={{ "--delay": `${b.at}ms` } as CSSProperties}>
            {b.node}
          </div>
        ))}
      </div>
    </div>
  );

  if (frame === "plain") return <div className={className}>{thread}</div>;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[300px] rounded-[2.4rem] border border-border bg-card p-2 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.9rem] border border-border/60 bg-background">
        <div aria-hidden className="absolute top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-card" />
        <div className="pt-6">{thread}</div>
      </div>
    </div>
  );
}

/** The last exchange only: "Ordered" plus the receipt. */
export function ConfirmationMock(props: Omit<MessageThreadMockProps, "variant">) {
  return <MessageThreadMock {...props} variant="confirmation" />;
}

function ThreadHeader({ agentName, avatar }: { agentName: string; avatar?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border-b border-border/70 px-4 pt-2 pb-3">
      {avatar ?? <GoatAvatar size={40} />}
      <div className="text-center leading-tight">
        <p className="text-xs font-semibold">{agentName}</p>
        <p className="text-[10px] text-muted-foreground">Agent</p>
      </div>
    </div>
  );
}

export function GoatAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/mark.png"
      alt=""
      width={size}
      height={size}
      className={cn("rounded-full bg-card object-cover", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** A colored circle with a letter. Used for the fictional brands. */
export function InitialAvatar({ letter, size = 40, className }: { letter: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground", className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </span>
  );
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <p className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[13px] leading-snug text-primary-foreground">
      {children}
    </p>
  );
}

function AgentBubble({ children }: { children: ReactNode }) {
  return (
    <div className="mr-auto max-w-[86%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-[13px] leading-snug text-foreground">
      {children}
    </div>
  );
}

function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="my-0.5 flex items-center justify-center gap-1 text-center text-[10.5px] font-medium text-muted-foreground">
      <Check className="size-3" />
      {children}
    </p>
  );
}

function script(variant: ThreadVariant): Bubble[] {
  const ask: Bubble = { key: "ask", at: 250, node: <UserBubble>Get me a grande latte from the Starbucks on 5th</UserBubble> };
  const request: Bubble = {
    key: "request",
    at: 1300,
    node: (
      <AgentBubble>
        On it. I need $8 on your card for this. Approve here:
        <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
          <Lock className="size-3 shrink-0 text-primary" />
          <span className="truncate">goat.wallet/approve/…</span>
        </span>
      </AgentBubble>
    ),
  };
  const approved: Bubble = { key: "approved", at: 2500, node: <StatusLine>You approved $8.00 · Visa •••• 4242</StatusLine> };
  const done: Bubble = {
    key: "done",
    at: 3300,
    node: (
      <AgentBubble>
        Ordered. Pickup in 6 min. Receipt below.
        <span className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-[11.5px]">
          <span className="flex flex-col leading-tight">
            <span className="font-semibold">Starbucks</span>
            <span className="text-muted-foreground">Grande Latte</span>
          </span>
          <span className="font-semibold tabular-nums">$6.45</span>
        </span>
      </AgentBubble>
    ),
  };

  if (variant === "request") return [ask, request];
  if (variant === "confirmation") return [{ ...approved, at: 250 }, { ...done, at: 1000 }];
  return [ask, request, approved, done];
}
