"use client";

import { cn } from "@/lib/cn";
import { ContactAvatar } from "./avatar";
import { ChevronLeftIcon, MicIcon, MonitorIcon, PlusIcon } from "./icons";
import { type ChatMessage, type ChatScreenProps, delayStyle } from "./model";
import { messageAttrs, useFollowLatest } from "./use-follow-latest";

/*
 * A Grok-style bot app, used by the BotBot example: a white canvas, #0a0a0a
 * ink, the bot's avatar and name in the top bar, a centered gray timestamp,
 * the bot's messages in light gray rounded bubbles on the left, the user's
 * in near-black bubbles on the right, centered gray status lines, and a
 * pill composer with a + button, a "Message <bot>" prompt, and a round dark
 * mic button.
 */

const INK = "text-[#0a0a0a]";
const GRAY = "text-[#141414]/60";
const BOT_BUBBLE = "bg-[#0a0a0a]/[0.055]";
const USER_BUBBLE = "bg-[#111110] text-white";
const LINE = "border-[#e6e5e2]";

export function GrokScreen({ name, logo, logoStyle, messages }: ChatScreenProps) {
  const thread = useFollowLatest<HTMLDivElement>();
  return (
    <div className={cn("flex h-full flex-col bg-white text-[12.5px] leading-[1.35] antialiased", INK)}>
      <Header name={name} logo={logo} logoStyle={logoStyle} />
      <div ref={thread} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mt-auto flex flex-col gap-2 px-3 pt-2 pb-2">
          <p className={cn("mb-1 text-center text-[10.5px]", GRAY)}>9:41 AM</p>
          {messages.map((m) => (
            <div key={m.key} {...messageAttrs(m.at)} className="landing-bubble flex flex-col" style={delayStyle(m.at)}>
              <Message m={m} />
            </div>
          ))}
        </div>
      </div>
      <Composer name={name} />
    </div>
  );
}

function Header({ name, logo, logoStyle }: Pick<ChatScreenProps, "name" | "logo" | "logoStyle">) {
  return (
    <div className={cn("flex items-center gap-2 border-b px-3 pt-11 pb-2", LINE)}>
      <ChevronLeftIcon width={20} height={20} strokeWidth={2.2} className="-ml-1 shrink-0" />
      <ContactAvatar size={26} logo={logo} logoStyle={logoStyle} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight">{name}</span>
      <MonitorIcon width={18} height={18} strokeWidth={1.8} className={GRAY} />
    </div>
  );
}

function Message({ m }: { m: ChatMessage }) {
  if (m.from === "status") {
    return <p className={cn("my-1 text-center text-[10.5px]", GRAY)}>{m.node}</p>;
  }
  if (m.from === "user") {
    return <div className={cn("ml-auto max-w-[82%] rounded-[16px] px-3 py-2", USER_BUBBLE)}>{m.node}</div>;
  }
  if (m.card && m.bare) {
    return <div className="flex">{m.card}</div>;
  }
  return (
    <div className={cn("mr-auto flex max-w-[86%] flex-col gap-2 rounded-[16px] px-3 py-2", BOT_BUBBLE, m.card && "w-full max-w-[86%] p-1.5")}>
      {m.node ? <p>{m.node}</p> : null}
      {m.link ? <Source domain={m.link.domain} title={m.link.title} /> : null}
      {m.card ? <div className={cn("overflow-hidden rounded-[12px] border bg-white", LINE)}>{m.card}</div> : null}
    </div>
  );
}

/** A link the bot sent: a white card with a hairline border, like the app's task cards. */
function Source({ domain, title }: { domain: string; title: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[12px] border bg-white px-2.5 py-2 leading-tight", LINE)}>
      <span className="truncate text-[12px] font-medium">{title}</span>
      <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
    </div>
  );
}

function Composer({ name }: { name: string }) {
  return (
    <div className="px-3 pt-1 pb-7">
      <div className={cn("flex h-[42px] items-center gap-2 rounded-full border bg-white pr-[5px] pl-[5px] text-[12.5px]", LINE, GRAY)}>
        <span className={cn("inline-flex size-[32px] shrink-0 items-center justify-center rounded-full", BOT_BUBBLE)}>
          <PlusIcon width={15} height={15} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate">Message {name}</span>
        <span className="inline-flex size-[32px] shrink-0 items-center justify-center rounded-full bg-[#111110] text-white">
          <MicIcon width={15} height={15} strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}
