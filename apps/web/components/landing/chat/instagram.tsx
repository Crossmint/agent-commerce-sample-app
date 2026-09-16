import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ContactAvatar } from "./avatar";
import { CameraIcon, ChevronLeftIcon, ImageIcon, LockIcon, MicIcon, PhoneIcon, StickerIcon, VideoIcon } from "./icons";
import { type ChatMessage, type ChatScreenProps, delayStyle, endsGroup, isLastFromUser } from "./model";

/*
 * Instagram Direct, dark. Black canvas, #262626 received bubbles with a small
 * avatar beside the last one of a group, sent bubbles in the blue-purple DM
 * gradient, a tiny "Seen" under the last sent one. Bubbles in a group flatten
 * the corners that face each other. The composer is one pill with a gradient
 * camera button inside.
 */

const GRADIENT = "bg-[linear-gradient(160deg,#7a40f2_0%,#5b5cf0_45%,#3797f0_100%)]";
const GRAY = "text-[#a8a8a8]";

export function InstagramScreen({ name, logo, messages }: ChatScreenProps) {
  return (
    <div className="flex h-full flex-col bg-black text-[13px] leading-[1.3] text-white">
      <Header name={name} logo={logo} />
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div className="flex flex-col px-2.5 pt-2 pb-1">
          <p className={cn("mb-3 text-center text-[10.5px] font-medium", GRAY)}>Today 9:41 AM</p>
          {messages.map((m, i) => {
            const first = i === 0 || messages[i - 1]?.from !== m.from;
            const last = endsGroup(messages, i);
            return (
              <div key={m.key} className={cn("landing-bubble flex flex-col", last ? "mb-2.5" : "mb-[2px]")} style={delayStyle(m.at)}>
                <Message m={m} first={first} last={last} seen={isLastFromUser(messages, i)} logo={logo} />
              </div>
            );
          })}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function Header({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 bg-black px-2 pt-11 pb-2.5">
      <ChevronLeftIcon width={24} height={24} strokeWidth={2} className="-mr-0.5" />
      <ContactAvatar size={30} logo={logo} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12.5px] font-semibold">{name}</p>
        <p className={cn("text-[10.5px]", GRAY)}>Active now</p>
      </div>
      <PhoneIcon width={21} height={21} strokeWidth={1.8} />
      <VideoIcon width={23} height={23} strokeWidth={1.8} className="ml-1.5" />
    </div>
  );
}

function Message({ m, first, last, seen, logo }: { m: ChatMessage; first: boolean; last: boolean; seen: boolean; logo?: string }) {
  if (m.from === "status") return <p className={cn("my-1 text-center text-[10.5px] font-medium", GRAY)}>{m.node}</p>;
  const sent = m.from === "user";
  const radius = sent
    ? cn("rounded-[20px]", !first && "rounded-tr-[5px]", !last && "rounded-br-[5px]")
    : cn("rounded-[20px]", !first && "rounded-tl-[5px]", !last && "rounded-bl-[5px]");
  const skin = sent ? GRADIENT : "bg-[#262626]";

  let body: ReactNode;
  if (m.link) {
    body = (
      <div className={cn("w-[80%] overflow-hidden", radius, skin)}>
        <LinkPreview domain={m.link.domain} title={m.link.title} />
      </div>
    );
  } else if (m.card) {
    body = <div className={cn("w-[84%] overflow-hidden", radius, skin)}>{m.card}</div>;
  } else {
    body = <div className={cn("max-w-[78%] px-3 py-[7px]", radius, skin)}>{m.node}</div>;
  }

  if (sent) {
    return (
      <>
        <div className="flex justify-end">{body}</div>
        {seen ? <span className={cn("mt-[3px] pr-1 text-right text-[10px]", GRAY)}>Seen</span> : null}
      </>
    );
  }
  return (
    <div className="flex items-end gap-1.5">
      {/* The avatar sits by the last bubble of a group; a spacer keeps the others aligned. */}
      {last ? <ContactAvatar size={22} logo={logo} /> : <span className="w-[22px] shrink-0" />}
      {body}
    </div>
  );
}

function LinkPreview({ domain, title }: { domain: string; title: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex h-[70px] items-center justify-center bg-gradient-to-br from-[#2b2b2b] to-[#141414]">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-white/10">
          <LockIcon width={17} height={17} strokeWidth={2.2} className="text-white/85" />
        </span>
      </div>
      <div className="flex flex-col gap-px px-3 py-2">
        <span className="truncate text-[12px] font-semibold leading-tight">{title}</span>
        <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div className="bg-black px-2.5 pt-1.5 pb-7">
      <div className={cn("flex h-[38px] items-center gap-2 rounded-full bg-[#262626] pr-3 pl-[4px] text-[12.5px]", GRAY)}>
        <span className={cn("inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-white", GRADIENT)}>
          <CameraIcon width={17} height={17} strokeWidth={2} />
        </span>
        <span className="flex-1">Message…</span>
        <MicIcon width={19} height={19} strokeWidth={1.8} className="text-white" />
        <ImageIcon width={19} height={19} strokeWidth={1.8} className="text-white" />
        <StickerIcon width={19} height={19} strokeWidth={1.8} className="text-white" />
      </div>
    </div>
  );
}
