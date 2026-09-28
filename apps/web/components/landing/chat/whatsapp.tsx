"use client";

import type { CSSProperties, ReactNode } from "react";
import { Camera, CheckCheck, ChevronLeft, Mic, Phone, Plus, Sticker, Video } from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import { cn } from "@/lib/cn";
import { STORY } from "../story";
import { type ChatMessage, delayStyle, endsGroup, startsGroup } from "./model";
import { messageAttrs, useFollowLatest } from "./use-follow-latest";

/*
 * WhatsApp, iOS light appearance, in WhatsApp's own colors: a #F6F6F6 nav
 * bar, the beige wallpaper with a faint dot doodle, white received bubbles,
 * #D9FDD3 sent bubbles, a tail on the first bubble of a group, a tiny time
 * inside every bubble and two blue ticks on sent ones. Links are the grey
 * preview block over the URL. The contact is Acme Agent.
 *
 * The literal colors are the exception the landing allows: a mock of a real
 * third-party app wears that app's colors.
 */

const BLUE = "text-[#007AFF]";
const GRAY = "text-[#8E8E93]";
const TIME = "text-[#667781]";
const TIME_STAMP = "10:41";

/** The wallpaper: beige with a faint repeating dot doodle. */
const WALLPAPER: CSSProperties = {
  backgroundColor: "#EFE7DD",
  backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.055) 1.2px, transparent 0)",
  backgroundSize: "14px 14px",
};

export function WhatsAppScreen({
  name = STORY.agent,
  messages,
}: {
  name?: string;
  messages: ChatMessage[];
}) {
  const thread = useFollowLatest<HTMLDivElement>();
  return (
    <div className="flex h-full flex-col bg-white text-[13px] leading-[1.3] text-black antialiased">
      <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#F6F6F6] px-2 pt-10 pb-2">
        <ChevronLeft className={cn("size-6 shrink-0", BLUE)} strokeWidth={2.4} />
        <AgentAvatar size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12.5px] font-semibold">{name}</p>
          <p className={cn("text-[10.5px]", GRAY)}>online</p>
        </div>
        <Video className={cn("size-[22px] shrink-0", BLUE)} strokeWidth={1.9} />
        <Phone className={cn("ml-2 mr-1 size-[19px] shrink-0", BLUE)} strokeWidth={1.9} />
      </div>
      <div
        ref={thread}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
        style={WALLPAPER}
      >
        <div className="mt-auto flex flex-col px-2.5 pt-2.5 pb-1.5">
          <Chip className="mb-2.5">Today</Chip>
          {messages.map((m, i) => {
            const first = startsGroup(messages, i);
            const last = endsGroup(messages, i);
            return (
              <div
                key={m.key}
                {...messageAttrs(m.at)}
                className={cn("landing-bubble flex flex-col", last ? "mb-2" : "mb-[3px]")}
                style={delayStyle(m.at)}
              >
                <Message m={m} first={first} />
              </div>
            );
          })}
        </div>
      </div>
      <Composer />
    </div>
  );
}

/** A centered system chip: the date, or a status line. */
function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn("flex justify-center", className)}>
      <span className="rounded-[8px] bg-white/90 px-2 py-[3px] text-center text-[10px] font-medium text-[#54656F] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
        {children}
      </span>
    </p>
  );
}

function Message({ m, first }: { m: ChatMessage; first: boolean }) {
  if (m.from === "status") return <Chip className="my-1">{m.node}</Chip>;
  const sent = m.from === "user";
  const side = sent ? "ml-auto" : "mr-auto";
  const skin = sent ? "bg-[#D9FDD3]" : "bg-white";
  const tail = first
    ? sent
      ? "landing-wa-tail-sent rounded-tr-none"
      : "landing-wa-tail-recv rounded-tl-none"
    : "";
  const bubble = cn(
    "relative rounded-[8px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
    skin,
    side,
    tail,
  );

  if (m.card && m.bare) return <div className={cn("flex w-[86%]", side)}>{m.card}</div>;

  if (m.link) {
    return (
      <div className={cn(bubble, "w-[82%] p-[3px] pb-[16px]")}>
        <LinkPreview domain={m.link.domain} title={m.link.title} description={m.link.description} />
        <p className="px-1.5 pt-1 text-[12px] leading-snug break-all text-[#027EB5]">
          {m.link.url ?? `https://${m.link.domain}`}
        </p>
        <Time sent={sent} />
      </div>
    );
  }
  return (
    <div className={cn(bubble, "max-w-[78%] px-2 pt-[6px] pb-[15px]")}>
      {m.card ?? <span>{m.node}</span>}
      <Time sent={sent} />
    </div>
  );
}

/** The time in the bubble's bottom right corner, with two blue ticks on sent bubbles. */
function Time({ sent }: { sent: boolean }) {
  return (
    <span
      className={cn(
        "absolute right-1.5 bottom-[3px] flex items-center gap-[3px] text-[9px] leading-none",
        TIME,
      )}
    >
      {TIME_STAMP}
      {sent ? <CheckCheck className="size-3 text-[#53BDEB]" strokeWidth={2.4} /> : null}
    </span>
  );
}

/** The grey preview block: title, one line, the host. */
function LinkPreview({
  domain,
  title,
  description,
}: {
  domain: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-px rounded-[6px] bg-[#F0F0F0] px-2 py-1.5">
      <span className="truncate text-[12px] leading-tight font-semibold">{title}</span>
      {description ? (
        <span className={cn("truncate text-[10.5px]", TIME)}>{description}</span>
      ) : null}
      <span className={cn("truncate text-[10.5px]", TIME)}>{domain}</span>
    </div>
  );
}

function Composer() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-2 border-t border-black/10 bg-[#F6F6F6] px-2.5 pt-1.5 pb-7"
    >
      <Plus className={cn("size-6 shrink-0", BLUE)} strokeWidth={2} />
      <span
        className={cn(
          "flex h-[33px] flex-1 items-center justify-between rounded-full border border-black/10 bg-white pr-2 pl-3 text-[12.5px]",
          GRAY,
        )}
      >
        Message
        <Sticker className="size-[18px]" strokeWidth={1.8} />
      </span>
      <Camera className={cn("size-[22px] shrink-0", BLUE)} strokeWidth={1.8} />
      <Mic className={cn("size-[21px] shrink-0", BLUE)} strokeWidth={1.8} />
    </div>
  );
}
