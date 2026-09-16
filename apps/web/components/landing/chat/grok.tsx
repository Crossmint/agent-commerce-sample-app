import Image from "next/image";
import { cn } from "@/lib/cn";
import { ArrowUpIcon, ChevronDownIcon, ComposeIcon, CopyIcon, LockIcon, MenuIcon, MicIcon, PaperclipIcon, RefreshIcon, ThumbIcon } from "./icons";
import { type ChatMessage, type ChatScreenProps, delayStyle } from "./model";

/*
 * The Grok app, light theme. grok.com's warm off-white (#f9f8f7) canvas,
 * near-black text, the user's prompts right-aligned in a soft gray rounded
 * box, Grok's answers as plain text under the Grok mark with an action row.
 * A menu button, "Grok" and a model pill in the top bar; an "Ask anything"
 * prompt bar with attach and mic icons and a black round send button.
 */

export const GROK_BG = "#f9f8f7";
const GRAY = "text-[#636363]";
const BOX = "bg-[#eeedeb]";
const LINE = "border-black/6";

export function GrokScreen({ messages }: ChatScreenProps) {
  const lastAgent = [...messages].reverse().find((m) => m.from === "agent");
  return (
    <div className="flex h-full flex-col bg-[#f9f8f7] text-[13px] leading-[1.35] text-[#050505] antialiased">
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
      <span className="flex items-center gap-2">
        <Image src="/logos/grok-wordmark.svg" alt="Grok" width={88} height={33} className="h-[17px] w-auto" />
        <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[10.5px] font-medium", BOX, GRAY)}>
          Fast
          <ChevronDownIcon width={11} height={11} strokeWidth={2.5} />
        </span>
      </span>
      <ComposeIcon width={21} height={21} strokeWidth={1.8} />
    </div>
  );
}

/** The Grok glyph. The file is white on transparent; the filter makes it black for the light theme. */
export function GrokMark({ size = 16, className }: { size?: number; className?: string }) {
  return <Image src="/logos/grok.svg" alt="" width={size} height={size} style={{ width: size, height: size }} className={cn("shrink-0 brightness-0", className)} />;
}

function Message({ m, actions }: { m: ChatMessage; actions: boolean }) {
  if (m.from === "status") {
    return <p className={cn("my-0.5 text-center text-[10.5px]", GRAY)}>{m.node}</p>;
  }
  if (m.from === "user") {
    return <div className={cn("ml-auto max-w-[80%] rounded-[18px] px-3.5 py-2", BOX)}>{m.node}</div>;
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
          {m.card ? <div className={cn("overflow-hidden rounded-[12px] border bg-white", LINE)}>{m.card}</div> : null}
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
    <div className={cn("flex items-center gap-2 rounded-[12px] border bg-white px-2.5 py-2", LINE)}>
      <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-[6px]", BOX)}>
        <LockIcon width={12} height={12} strokeWidth={2.2} className="text-[#050505]/80" />
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
      <div className={cn("flex h-[42px] items-center gap-2 rounded-full border bg-white pr-[5px] pl-3 text-[12.5px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]", LINE, GRAY)}>
        <PaperclipIcon width={18} height={18} strokeWidth={1.8} />
        <span className="flex-1">Ask anything</span>
        <MicIcon width={18} height={18} strokeWidth={1.8} />
        <span className="inline-flex size-[32px] items-center justify-center rounded-full bg-black text-white">
          <ArrowUpIcon width={15} height={15} strokeWidth={2.75} />
        </span>
      </div>
    </div>
  );
}
