"use client";

import type { ReactNode } from "react";
import {
  Camera,
  ChevronLeft,
  Image as ImageIcon,
  Lock,
  Mic,
  Phone,
  Sticker,
  Video,
} from "lucide-react";
import { AgentAvatar } from "@/components/brand";
import { cn } from "@/lib/cn";
import { STORY } from "../story";
import { type ChatMessage, delayStyle, endsGroup, isLastFromUser, startsGroup } from "./model";
import { messageAttrs, useFollowLatest } from "./use-follow-latest";

/*
 * Instagram Direct, light appearance, in Instagram's own colors: white
 * canvas, #EFEFEF received bubbles with the contact's small avatar beside
 * the last one of a group, sent bubbles in the blue-purple DM gradient, a
 * tiny "Seen" under the last sent one. Bubbles in a group flatten the
 * corners that face each other. The composer is one grey pill with a
 * gradient camera button inside. The contact is Acme Agent.
 *
 * The literal colors are the exception the landing allows: a mock of a real
 * third-party app wears that app's colors.
 */

const GRADIENT = "bg-[linear-gradient(160deg,#7a40f2_0%,#5b5cf0_45%,#3797f0_100%)]";
const GRAY = "text-[#737373]";

export function InstagramScreen({
  name = STORY.agent,
  messages,
}: {
  name?: string;
  messages: ChatMessage[];
}) {
  const thread = useFollowLatest<HTMLDivElement>();
  return (
    <div className="flex h-full flex-col bg-white text-[13px] leading-[1.3] text-black antialiased">
      <div className="flex items-center gap-2 border-b border-black/10 bg-white px-2 pt-11 pb-2.5">
        <ChevronLeft className="-mr-0.5 size-6 shrink-0" strokeWidth={2} />
        <AgentAvatar size={30} className="rounded-full ring-1 ring-black/10" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12.5px] font-semibold">{name}</p>
          <p className={cn("text-[10.5px]", GRAY)}>Active now</p>
        </div>
        <Phone className="size-[21px] shrink-0" strokeWidth={1.8} />
        <Video className="ml-1.5 size-[23px] shrink-0" strokeWidth={1.8} />
      </div>
      <div ref={thread} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mt-auto flex flex-col px-2.5 pt-2 pb-1">
          <p className={cn("mb-3 text-center text-[10.5px] font-medium", GRAY)}>Today 9:41 AM</p>
          {messages.map((m, i) => {
            const first = startsGroup(messages, i);
            const last = endsGroup(messages, i);
            return (
              <div
                key={m.key}
                {...messageAttrs(m.at)}
                className={cn("landing-bubble flex flex-col", last ? "mb-2.5" : "mb-[2px]")}
                style={delayStyle(m.at)}
              >
                <Message m={m} first={first} last={last} seen={isLastFromUser(messages, i)} />
              </div>
            );
          })}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function Message({
  m,
  first,
  last,
  seen,
}: {
  m: ChatMessage;
  first: boolean;
  last: boolean;
  seen: boolean;
}) {
  if (m.from === "status")
    return <p className={cn("my-1 text-center text-[10.5px] font-medium", GRAY)}>{m.node}</p>;
  const sent = m.from === "user";
  const radius = sent
    ? cn("rounded-[18px]", !first && "rounded-tr-[4px]", !last && "rounded-br-[4px]")
    : cn("rounded-[18px]", !first && "rounded-tl-[4px]", !last && "rounded-bl-[4px]");
  const skin = sent ? cn(GRADIENT, "text-white") : "bg-[#EFEFEF] text-black";

  let body: ReactNode;
  if (m.link) {
    body = (
      <div className={cn("w-[80%] overflow-hidden p-1", radius, skin)}>
        <LinkPreview domain={m.link.domain} title={m.link.title} />
      </div>
    );
  } else if (m.card && m.bare) {
    body = <div className="flex min-w-0 flex-1">{m.card}</div>;
  } else if (m.card) {
    body = <div className={cn("w-[84%] overflow-hidden", radius, skin)}>{m.card}</div>;
  } else {
    body = <div className={cn("max-w-[78%] px-3 py-[7px]", radius, skin)}>{m.node}</div>;
  }

  if (sent) {
    return (
      <>
        <div className="flex justify-end">{body}</div>
        {seen ? (
          <span className={cn("mt-[3px] pr-1 text-right text-[10px]", GRAY)}>Seen</span>
        ) : null}
      </>
    );
  }
  return (
    <div className="flex items-end gap-1.5">
      {/* The avatar sits by the last bubble of a group; a spacer keeps the others aligned. */}
      {last ? (
        <AgentAvatar size={22} className="rounded-full ring-1 ring-black/10" />
      ) : (
        <span className="w-[22px] shrink-0" />
      )}
      {body}
    </div>
  );
}

/** A white card with a thin border inside the bubble: a preview band, then title and host. */
function LinkPreview({ domain, title }: { domain: string; title: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] bg-white text-black ring-1 ring-black/10">
      <div className="flex h-[62px] items-center justify-center bg-[#FAFAFA]">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-black/8">
          <Lock className="size-[17px] text-black/70" strokeWidth={2.2} />
        </span>
      </div>
      <div className="flex flex-col gap-px px-3 py-2">
        <span className="truncate text-[12px] leading-tight font-semibold">{title}</span>
        <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div aria-hidden className="bg-white px-2.5 pt-1.5 pb-7">
      <div
        className={cn(
          "flex h-[38px] items-center gap-2 rounded-full bg-[#EFEFEF] pr-3 pl-[4px] text-[12.5px]",
          GRAY,
        )}
      >
        <span
          className={cn(
            "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-white",
            GRADIENT,
          )}
        >
          <Camera className="size-[17px]" strokeWidth={2} />
        </span>
        <span className="flex-1">Message...</span>
        <Mic className="size-[19px] text-black" strokeWidth={1.8} />
        <ImageIcon className="size-[19px] text-black" strokeWidth={1.8} />
        <Sticker className="size-[19px] text-black" strokeWidth={1.8} />
      </div>
    </div>
  );
}
