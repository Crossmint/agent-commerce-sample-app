"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Camera, Check, CheckCheck, ChevronLeft, ChevronRight, Lock, Mic, MoreVertical, Phone, Plus, Smile, Video } from "lucide-react";
import { cn } from "@/lib/cn";
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
export type ThreadStyle = "imessage" | "whatsapp";

export interface MessageThreadMockProps {
  /** Messaging app skin. */
  style?: ThreadStyle;
  /** Which part of the story to show. Default "full". */
  variant?: ThreadVariant;
  /** Name in the thread header. Default "Your agent". */
  agentName?: string;
  /** Host in the approval link. Default "yourplatform.com". */
  domain?: string;
  className?: string;
  /** Accessible description for the phone. */
  label?: string;
  /** Frame width in CSS px at full size. Default 300. */
  width?: number;
}

export interface Bubble {
  key: string;
  from: "user" | "agent" | "status";
  node: ReactNode;
  /** ms after the thread enters view. */
  at: number;
}

/** Screen color behind the status bar for each chat skin. */
export const THREAD_SCREEN_BG: Record<ThreadStyle, string> = { imessage: "bg-[#1c1c1e]", whatsapp: "bg-[#075e54]" };

/**
 * A chat thread inside a phone: the user asks, the agent asks for a budget,
 * the user approves, the agent sends the receipt. Bubbles appear in sequence
 * and the sequence restarts each time the thread scrolls back into view.
 */
export function MessageThreadMock({ className, label, width, ...screen }: MessageThreadMockProps) {
  const style = screen.style ?? "imessage";
  const wa = style === "whatsapp";
  return (
    <PhoneFrame
      className={className}
      width={width}
      screenClassName={THREAD_SCREEN_BG[style]}
      label={label ?? `A ${wa ? "WhatsApp" : "iMessage"} thread with ${screen.agentName ?? "Your agent"}`}
    >
      <MessageThreadScreen {...screen} />
    </PhoneFrame>
  );
}

export type MessageThreadScreenProps = Omit<MessageThreadMockProps, "className" | "label" | "width">;

/** The thread without the phone. Use it to stack screens inside one `PhoneFrame`. */
export function MessageThreadScreen({ style = "imessage", variant = "full", agentName = "Your agent", domain = "yourplatform.com" }: MessageThreadScreenProps) {
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

  const bubbles = script(variant, domain, style);
  const wa = style === "whatsapp";

  return (
    <div ref={ref} className="flex h-full flex-col font-sans text-[13px] text-white">
      {wa ? <WhatsAppHeader name={agentName} /> : <IMessageHeader name={agentName} />}
      <div key={run} className={cn("flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-2.5 pt-2.5", wa ? "landing-wa-doodle" : "bg-black")}>
        {wa ? (
          <span className="mx-auto mb-1 rounded-md bg-[#182229] px-2 py-0.5 text-[10px] font-medium text-[#8696a0]">Today</span>
        ) : (
          <p className="mb-1 text-center text-[10px] text-[#8e8e93]">
            <span className="font-semibold">iMessage</span>
            <br />
            Today 9:41
          </p>
        )}
        {bubbles.map((b, i) => (
          <div key={b.key} className="landing-bubble flex flex-col" style={{ "--delay": `${b.at}ms` } as CSSProperties}>
            {wa ? <WhatsAppBubble b={b} /> : <IMessageBubble b={b} delivered={b.from === "user" && !bubbles.slice(i + 1).some((n) => n.from === "user")} />}
          </div>
        ))}
      </div>
      {wa ? <WhatsAppComposer /> : <IMessageComposer />}
    </div>
  );
}

/** A neutral robot avatar for "Your agent". */
export function AgentAvatar({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#48484a] text-white", className)}
      style={{ width: size, height: size }}
    >
      <Bot style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2} />
    </span>
  );
}

/* ---------- iMessage ---------- */

function IMessageHeader({ name }: { name: string }) {
  return (
    <div className="flex items-end justify-between bg-[#1c1c1e] px-3 pt-11 pb-2 text-[#0a84ff]">
      <ChevronLeft className="mb-3 size-6" strokeWidth={2.25} />
      <div className="flex flex-col items-center gap-1 text-white">
        <AgentAvatar size={38} />
        <span className="flex items-center text-[10.5px] leading-none">
          {name}
          <ChevronRight className="size-2.5 text-[#8e8e93]" strokeWidth={3} />
        </span>
      </div>
      <Video className="mb-3 size-6" strokeWidth={2} />
    </div>
  );
}

function IMessageBubble({ b, delivered }: { b: Bubble; delivered: boolean }) {
  if (b.from === "status") return <p className="my-1 text-center text-[10px] font-medium text-[#8e8e93]">{b.node}</p>;
  if (b.from === "user") {
    return (
      <>
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-[5px] bg-[#0a84ff] px-3 py-1.5 leading-snug">{b.node}</div>
        {delivered ? <span className="mt-0.5 text-right text-[10px] text-[#8e8e93]">Delivered</span> : null}
      </>
    );
  }
  return <div className="mr-auto max-w-[86%] rounded-2xl rounded-bl-[5px] bg-[#3a3a3c] px-3 py-1.5 leading-snug">{b.node}</div>;
}

function IMessageComposer() {
  return (
    <div className="flex items-center gap-2 bg-black px-3 pt-2 pb-7 text-[#8e8e93]">
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#2c2c2e]">
        <Plus className="size-4" />
      </span>
      <span className="flex h-8 flex-1 items-center justify-between rounded-full border border-[#3a3a3c] px-3 text-[12px]">
        iMessage
        <Mic className="size-3.5" />
      </span>
    </div>
  );
}

/* ---------- WhatsApp ---------- */

export function WhatsAppHeader({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#075e54] px-2 pt-11 pb-2.5 text-white">
      <ChevronLeft className="size-5" strokeWidth={2.25} />
      <AgentAvatar size={32} className="bg-[#128c7e]" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-semibold">{name}</p>
        <p className="text-[10px] text-white/75">online</p>
      </div>
      <Video className="size-[18px]" />
      <Phone className="ml-1.5 size-4" />
      <MoreVertical className="ml-1 size-4" />
    </div>
  );
}

export function WhatsAppBubble({ b }: { b: Bubble }) {
  if (b.from === "status") {
    return <p className="mx-auto my-1 rounded-md bg-[#182229] px-2 py-0.5 text-center text-[10px] font-medium text-[#8696a0]">{b.node}</p>;
  }
  const sent = b.from === "user";
  return (
    <div
      className={cn(
        "relative max-w-[84%] rounded-lg px-2.5 pt-1.5 pb-1 leading-snug text-[#e9edef] shadow-[0_1px_0.5px_rgba(0,0,0,0.3)]",
        sent ? "ml-auto rounded-tr-none bg-[#005c4b]" : "mr-auto rounded-tl-none bg-[#202c33]",
      )}
    >
      {b.node}
      <span className="mt-0.5 flex items-center justify-end gap-1 text-[9.5px] text-[#8696a0]">
        9:41
        {sent ? <CheckCheck className="size-3.5 text-[#53bdeb]" strokeWidth={2.25} /> : null}
      </span>
    </div>
  );
}

export function WhatsAppComposer() {
  return (
    <div className="landing-wa-doodle flex items-center gap-2 px-2 pt-2 pb-7 text-[#8696a0]">
      <span className="flex h-9 flex-1 items-center gap-2 rounded-full bg-[#202c33] px-3 text-[12px]">
        <Smile className="size-4" />
        <span className="flex-1">Message</span>
        <Camera className="size-4" />
      </span>
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#00a884] text-white">
        <Mic className="size-4" />
      </span>
    </div>
  );
}

/* ---------- Script ---------- */

function script(variant: ThreadVariant, domain: string, style: ThreadStyle): Bubble[] {
  const linkColor = style === "whatsapp" ? "text-[#53bdeb]" : "text-[#6fb1ff]";
  const ask: Bubble = { key: "ask", from: "user", at: 250, node: <>Get me a grande latte from the Starbucks on 5th</> };
  const request: Bubble = {
    key: "request",
    from: "agent",
    at: 1300,
    node: (
      <>
        On it. I need $8 on your card for this. Approve here:
        <span className={cn("mt-1 flex items-center gap-1 text-[12px] underline underline-offset-2", linkColor)}>
          <Lock className="size-3 shrink-0" strokeWidth={2.5} />
          <span className="truncate">{domain}/approve/…</span>
        </span>
      </>
    ),
  };
  const approved: Bubble = {
    key: "approved",
    from: "status",
    at: 2500,
    node: (
      <span className="inline-flex items-center gap-1">
        <Check className="size-3" strokeWidth={3} />
        You approved $8.00 · Visa •••• 4242
      </span>
    ),
  };
  const done: Bubble = {
    key: "done",
    from: "agent",
    at: 3300,
    node: (
      <>
        Ordered. Pickup in 6 min.
        <span className="mt-1.5 mb-0.5 flex items-center justify-between gap-3 rounded-lg bg-black/25 px-2.5 py-2 text-[11.5px]">
          <span className="flex flex-col leading-tight">
            <span className="font-semibold">Starbucks</span>
            <span className="opacity-70">Grande Latte</span>
          </span>
          <span className="font-semibold tabular-nums">$6.45</span>
        </span>
      </>
    ),
  };

  if (variant === "request") return [ask, request];
  if (variant === "approved") return [ask, request, { ...approved, at: 300 }];
  if (variant === "confirmation") return [{ ...approved, at: 250 }, { ...done, at: 1000 }];
  return [ask, request, approved, done];
}
