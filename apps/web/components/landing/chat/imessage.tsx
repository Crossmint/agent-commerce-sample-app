"use client";

import { ArrowUp, ChevronLeft, ChevronRight, Lock, Plus, Video } from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import { cn } from "@/lib/cn";
import { HomeIndicator } from "../landing-phone";
import { STORY } from "../story";
import { type ChatMessage, delayStyle, endsGroup, isLastFromUser } from "./model";
import { messageAttrs, useFollowLatest } from "./use-follow-latest";

/*
 * iMessage, iOS light appearance, in Apple's own colors: white canvas,
 * #E9E9EB received bubbles, #007AFF sent bubbles (systemBlue, light), a tail
 * on the last bubble of each group, "Delivered" under the last sent one, a
 * rich card for links, and the home indicator at the foot.
 * The nav bar is a three-column grid, so the contact stays centered whatever
 * the side widths are. The contact is Acme Agent.
 *
 * The literal colors are the exception the landing allows: a mock of a real
 * third-party app wears that app's colors.
 */

const BLUE = "text-[#007AFF]";
const GRAY = "text-[#8E8E93]";

export function IMessageScreen({
  name = STORY.agent,
  messages,
}: {
  name?: string;
  messages: ChatMessage[];
}) {
  const thread = useFollowLatest<HTMLDivElement>();
  return (
    <div className="relative flex h-full flex-col bg-white text-[13px] leading-[1.3] text-black antialiased">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end border-b border-black/10 bg-[#F6F6F6] px-2.5 pt-9 pb-1.5">
        <ChevronLeft className={cn("mb-4 -ml-1 size-6", BLUE)} strokeWidth={2.4} />
        <div className="flex flex-col items-center gap-[5px]">
          <AgentAvatar size={44} />
          <span className="flex items-center text-[10.5px] leading-none">
            {name}
            <ChevronRight className={cn("ml-px size-2.5", GRAY)} strokeWidth={3} />
          </span>
        </div>
        <Video className={cn("mb-4 size-6 justify-self-end", BLUE)} strokeWidth={2} />
      </div>
      <div ref={thread} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mt-auto flex flex-col px-2.5 pt-3 pb-1">
          <p className={cn("mb-2.5 text-center text-[10.5px]", GRAY)}>
            <span className="font-semibold">Today</span> 9:41 AM
          </p>
          {messages.map((m, i) => (
            <div
              key={m.key}
              {...messageAttrs(m.at)}
              className={cn(
                "landing-bubble flex flex-col",
                endsGroup(messages, i) ? "mb-2" : "mb-[3px]",
              )}
              style={delayStyle(m.at)}
            >
              <Message
                m={m}
                tail={endsGroup(messages, i)}
                delivered={isLastFromUser(messages, i)}
              />
            </div>
          ))}
        </div>
      </div>
      <Composer />
      <HomeIndicator className="bg-black/85" />
    </div>
  );
}

function Message({ m, tail, delivered }: { m: ChatMessage; tail: boolean; delivered: boolean }) {
  if (m.from === "status")
    return <p className={cn("my-1 text-center text-[10.5px] font-medium", GRAY)}>{m.node}</p>;
  const sent = m.from === "user";
  const side = sent ? "ml-auto" : "mr-auto";
  const tailCls = tail ? (sent ? "landing-im-tail-sent" : "landing-im-tail-recv") : "";
  const color = sent ? "bg-[#007AFF] text-white" : "bg-[#E9E9EB] text-black";

  if (m.link) {
    return (
      <div
        className={cn(
          "landing-im-bubble w-[80%] overflow-hidden rounded-[17px]",
          side,
          color,
          tailCls,
        )}
      >
        <LinkPreview domain={m.link.domain} title={m.link.title} />
      </div>
    );
  }
  if (m.card && m.bare) return <div className={cn("flex w-[86%]", side)}>{m.card}</div>;
  if (m.card)
    return (
      <div
        className={cn(
          "landing-im-bubble w-[84%] overflow-hidden rounded-[17px]",
          side,
          color,
          tailCls,
        )}
      >
        {m.card}
      </div>
    );
  return (
    <>
      <div
        className={cn(
          "landing-im-bubble max-w-[78%] rounded-[17px] px-[11px] py-[6px]",
          side,
          color,
          tailCls,
        )}
      >
        {/* A span, so the text paints above the tail: the tail's blocks sit under every element child, not under bare text. */}
        <span>{m.node}</span>
      </div>
      {delivered ? (
        <span className={cn("mt-[3px] pr-1 text-right text-[10px]", GRAY)}>Delivered</span>
      ) : null}
    </>
  );
}

/** A rich link card: a preview band, then title and host. */
function LinkPreview({ domain, title }: { domain: string; title: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex h-[68px] items-center justify-center bg-[#D1D1D6]">
        <span className="inline-flex size-9 items-center justify-center rounded-[9px] bg-white text-black ring-1 ring-black/10">
          <Lock className="size-[18px]" strokeWidth={2.2} />
        </span>
      </div>
      <div className="flex flex-col gap-px px-2.5 py-2">
        <span className="truncate text-[12px] leading-tight font-semibold">{title}</span>
        <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div aria-hidden className="flex items-center gap-2 bg-white px-2.5 pt-1.5 pb-7">
      <span
        className={cn(
          "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#E9E9EB]",
          GRAY,
        )}
      >
        <Plus className="size-4" strokeWidth={2.2} />
      </span>
      <span
        className={cn(
          "flex h-[31px] flex-1 items-center justify-between rounded-full border border-black/15 pr-[3px] pl-3 text-[12.5px]",
          GRAY,
        )}
      >
        iMessage
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#007AFF] text-white">
          <ArrowUp className="size-3.5" strokeWidth={3} />
        </span>
      </span>
    </div>
  );
}
