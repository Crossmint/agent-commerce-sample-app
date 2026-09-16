import Image from "next/image";
import { cn } from "@/lib/cn";
import { ArrowUpIcon, ChevronDownIcon, ComposeIcon, CopyIcon, LockIcon, MenuIcon, MicIcon, PaperclipIcon, RefreshIcon, ThumbIcon } from "./icons";
import { type ChatMessage, type ChatScreenProps, delayStyle } from "./model";

/*
 * The Grok app. Near-black canvas, the user's prompts right-aligned in a
 * slightly lighter rounded rectangle, Grok's replies as plain text under a
 * small Grok mark with an action row. A menu button, "Grok" and a model pill
 * in the top bar; an "Ask anything" prompt bar with attach and mic icons and
 * a round send button at the bottom.
 */

const GRAY = "text-[#8b8b8b]";

export function GrokScreen({ messages }: ChatScreenProps) {
  const lastAgent = [...messages].reverse().find((m) => m.from === "agent");
  return (
    <div className="flex h-full flex-col bg-[#050505] text-[13px] leading-[1.35] text-white">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div className="flex flex-col gap-3 px-3.5 pt-2 pb-2">
          {messages.map((m) => (
            <div key={m.key} className="landing-bubble flex flex-col" style={delayStyle(m.at)}>
              <Message m={m} actions={m === lastAgent} />
            </div>
          ))}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between px-3 pt-11 pb-2.5">
      <MenuIcon width={22} height={22} strokeWidth={1.8} />
      <span className="flex items-center gap-1.5 text-[14px] font-semibold tracking-tight">
        Grok
        <span className={cn("inline-flex items-center gap-0.5 rounded-full bg-[#1a1a1a] px-2 py-[3px] text-[10.5px] font-medium", GRAY)}>
          Grok 4
          <ChevronDownIcon width={11} height={11} strokeWidth={2.5} />
        </span>
      </span>
      <ComposeIcon width={21} height={21} strokeWidth={1.8} />
    </div>
  );
}

function GrokMark({ size = 16 }: { size?: number }) {
  return <Image src="/logos/grok.svg" alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0" />;
}

function Message({ m, actions }: { m: ChatMessage; actions: boolean }) {
  if (m.from === "status") {
    return <p className={cn("my-0.5 text-center text-[10.5px]", GRAY)}>{m.node}</p>;
  }
  if (m.from === "user") {
    return <div className="ml-auto max-w-[80%] rounded-[18px] bg-[#1c1c1c] px-3.5 py-2">{m.node}</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center">
          <GrokMark size={15} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {m.node ? <p>{m.node}</p> : null}
          {m.link ? <Source domain={m.link.domain} title={m.link.title} /> : null}
          {m.card ? <div className="overflow-hidden rounded-[12px] border border-[#262626] bg-[#0f0f0f]">{m.card}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className={cn("flex items-center gap-3.5 pl-[26px]", GRAY)}>
          <CopyIcon width={13} height={13} strokeWidth={1.8} />
          <ThumbIcon width={13} height={13} strokeWidth={1.8} />
          <ThumbIcon width={13} height={13} strokeWidth={1.8} className="rotate-180" />
          <RefreshIcon width={13} height={13} strokeWidth={1.8} />
        </div>
      ) : null}
    </div>
  );
}

/** A link as Grok shows one: a compact source card with a thin border. */
function Source({ domain, title }: { domain: string; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-[#262626] bg-[#0f0f0f] px-2.5 py-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-white/8">
        <LockIcon width={12} height={12} strokeWidth={2.2} className="text-white/85" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[12px] font-medium">{title}</span>
        <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
      </span>
    </div>
  );
}

function Composer() {
  return (
    <div className="px-3 pt-1 pb-7">
      <div className={cn("flex h-[42px] items-center gap-2 rounded-full border border-[#2a2a2a] bg-[#111] pr-[5px] pl-3 text-[12.5px]", GRAY)}>
        <PaperclipIcon width={18} height={18} strokeWidth={1.8} />
        <span className="flex-1">Ask anything</span>
        <MicIcon width={18} height={18} strokeWidth={1.8} />
        <span className="inline-flex size-[32px] items-center justify-center rounded-full bg-white text-black">
          <ArrowUpIcon width={15} height={15} strokeWidth={2.75} />
        </span>
      </div>
    </div>
  );
}
