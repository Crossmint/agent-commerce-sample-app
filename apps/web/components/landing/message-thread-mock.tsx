"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_APP_NAME, CHAT_SCREEN_BG, type ChatMessage, ChatScreen, type ChatStyle } from "./chat";
import { CheckIcon } from "./chat/icons";
import { PhoneFrame } from "./phone-frame";
import { useInView } from "./use-in-view";

/**
 * Which part of the story to show.
 * - request: the ask and the agent's approval link.
 * - approved: request, then the "You approved" status line.
 * - confirmation: the status line and the receipt.
 * - full: all four.
 */
export type ThreadVariant = "full" | "request" | "approved" | "confirmation";

export interface MessageThreadMockProps {
  /** Chat app skin. Default iMessage. */
  style?: ChatStyle;
  /** Which part of the story to show. Default "full". */
  variant?: ThreadVariant;
  /** Name in the thread header. Default "Your agent". */
  agentName?: string;
  /** Logo for the contact avatar. Default: a neutral robot mark. */
  logo?: string;
  /** Host in the approval link. Default "yourplatform.com". */
  domain?: string;
  className?: string;
  /** Accessible description for the phone. */
  label?: string;
  /** Frame width in CSS px at full size. Default 300. */
  width?: number;
}

/**
 * A chat thread inside a phone: the user asks, the agent asks for a budget,
 * the user approves, the agent sends the receipt. Bubbles appear in sequence
 * and the sequence restarts each time the thread scrolls back into view.
 */
export function MessageThreadMock({ className, label, width, ...screen }: MessageThreadMockProps) {
  const style = screen.style ?? "imessage";
  return (
    <PhoneFrame className={className} width={width} screenClassName={CHAT_SCREEN_BG[style]} label={label ?? `A ${CHAT_APP_NAME[style]} thread with ${screen.agentName ?? "Your agent"}`}>
      <MessageThreadScreen {...screen} />
    </PhoneFrame>
  );
}

export type MessageThreadScreenProps = Omit<MessageThreadMockProps, "className" | "label" | "width">;

/** The thread without the phone. Use it to stack screens inside one `PhoneFrame`. */
export function MessageThreadScreen({ style = "imessage", variant = "full", agentName = "Your agent", logo, domain = "yourplatform.com" }: MessageThreadScreenProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  // Remounting the messages restarts their CSS animations. The first run
  // starts on page load; later runs start on re-entry.
  const [run, setRun] = useState(0);
  const wasOut = useRef(false);
  useEffect(() => {
    if (inView === false) wasOut.current = true;
    if (inView === true && wasOut.current) {
      wasOut.current = false;
      setRun((r) => r + 1);
    }
  }, [inView]);

  return (
    <div ref={ref} className="h-full">
      <ChatScreen key={run} style={style} name={agentName} logo={logo} messages={script(variant, domain, agentName)} />
    </div>
  );
}

/* ---------- Script ---------- */

function script(variant: ThreadVariant, domain: string, agentName: string): ChatMessage[] {
  const ask: ChatMessage = { key: "ask", from: "user", at: 250, node: <>Get me a grande latte from the Starbucks on 5th</> };
  const request: ChatMessage = { key: "request", from: "agent", at: 1300, node: <>On it. I need $8 on your card for this. Approve here:</> };
  const link: ChatMessage = { key: "link", from: "agent", at: 1900, link: { domain, title: `Approve $8.00 for ${agentName}` } };
  const approved: ChatMessage = {
    key: "approved",
    from: "status",
    at: 2900,
    node: (
      <span className="inline-flex items-center gap-1">
        <CheckIcon width={11} height={11} />
        You approved $8.00 · Visa •••• 4242
      </span>
    ),
  };
  const done: ChatMessage = { key: "done", from: "agent", at: 3700, node: <>Ordered. Pickup in 6 min.</> };
  const receipt: ChatMessage = { key: "receipt", from: "agent", at: 4300, card: <Receipt /> };

  if (variant === "request") return [ask, request, link];
  // The approved thread follows the approval screen: the earlier messages are already there, only the status line lands.
  if (variant === "approved") return [{ ...ask, at: 0 }, { ...request, at: 0 }, { ...link, at: 0 }, { ...approved, at: 450 }];
  if (variant === "confirmation") return [{ ...approved, at: 250 }, { ...done, at: 1000 }, { ...receipt, at: 1600 }];
  return [ask, request, link, approved, done, receipt];
}

/** The order receipt as a small card. */
export function Receipt({ merchant = "Starbucks", item = "Grande Latte", total = "$6.45" }: { merchant?: string; item?: string; total?: string }) {
  return (
    <span className="flex items-center justify-between gap-3 px-3 py-2.5 text-[12px]">
      <span className="flex flex-col leading-tight">
        <span className="font-semibold">{merchant}</span>
        <span className="opacity-70">{item}</span>
      </span>
      <span className="font-semibold tabular-nums">{total}</span>
    </span>
  );
}
