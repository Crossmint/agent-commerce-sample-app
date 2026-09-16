import { cn } from "@/lib/cn";
import { ContactAvatar } from "./avatar";
import { ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, PlusIcon, VideoIcon } from "./icons";
import { type ChatMessage, type ChatScreenProps, delayStyle, endsGroup, isLastFromUser } from "./model";

/*
 * iMessage, iOS 17/18, dark appearance. Black canvas, #262628 received
 * bubbles, #0a84ff sent bubbles, a tail on the last bubble of each group,
 * "Delivered" under the last sent one, a rich card for links. The nav bar
 * stacks a large avatar over the contact name with a chevron.
 */

const GRAY = "text-[#8e8e93]";

export function IMessageScreen({ name, logo, messages }: ChatScreenProps) {
  return (
    <div className="landing-im flex h-full flex-col bg-black text-[13px] leading-[1.3] text-white">
      <Header name={name} logo={logo} />
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div className="flex flex-col px-2.5 pt-3 pb-1">
          <p className={cn("mb-2.5 text-center text-[10.5px]", GRAY)}>
            <span className="font-semibold">Today</span> 9:41
          </p>
          {messages.map((m, i) => (
            <div key={m.key} className={cn("landing-bubble flex flex-col", endsGroup(messages, i) ? "mb-2" : "mb-[3px]")} style={delayStyle(m.at)}>
              <Message m={m} tail={endsGroup(messages, i)} delivered={isLastFromUser(messages, i)} />
            </div>
          ))}
        </div>
      </div>
      <Composer />
    </div>
  );
}

function Header({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 bg-[#1c1c1e]/95 px-2.5 pt-10 pb-1.5 text-[#0a84ff]">
      <ChevronLeftIcon width={26} height={26} strokeWidth={2.4} className="mb-4 -ml-1" />
      <div className="flex flex-col items-center gap-[5px] text-white">
        <ContactAvatar size={46} logo={logo} />
        <span className="flex items-center text-[10.5px] leading-none">
          {name}
          <ChevronRightIcon width={9} height={9} strokeWidth={3} className={cn("ml-px", GRAY)} />
        </span>
      </div>
      <VideoIcon width={24} height={24} className="mb-4" />
    </div>
  );
}

function Message({ m, tail, delivered }: { m: ChatMessage; tail: boolean; delivered: boolean }) {
  if (m.from === "status") return <p className={cn("my-1 text-center text-[10.5px] font-medium", GRAY)}>{m.node}</p>;
  const sent = m.from === "user";
  const side = sent ? "ml-auto" : "mr-auto";
  const tailCls = tail ? (sent ? "landing-im-tail-sent" : "landing-im-tail-recv") : "";
  const color = sent ? "bg-[#0a84ff]" : "bg-[#262628]";

  if (m.link) {
    return (
      <div className={cn("landing-im-bubble w-[78%] overflow-hidden rounded-[17px]", side, color, tailCls)}>
        <LinkPreview domain={m.link.domain} title={m.link.title} />
      </div>
    );
  }
  if (m.card) {
    return <div className={cn("landing-im-bubble w-[84%] overflow-hidden rounded-[17px]", side, color, tailCls)}>{m.card}</div>;
  }
  return (
    <>
      <div className={cn("landing-im-bubble max-w-[78%] rounded-[17px] px-[11px] py-[6px]", side, color, tailCls)}>{m.node}</div>
      {delivered ? <span className={cn("mt-[3px] pr-1 text-right text-[10px]", GRAY)}>Delivered</span> : null}
    </>
  );
}

/** A rich link card: a preview image band, then title and host. */
function LinkPreview({ domain, title }: { domain: string; title: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex h-[72px] items-center justify-center bg-gradient-to-br from-[#2f2f31] via-[#1d1d1f] to-[#101011]">
        <span className="inline-flex size-9 items-center justify-center rounded-[9px] bg-white/10 ring-1 ring-white/10">
          <LockIcon width={18} height={18} strokeWidth={2.2} className="text-white/85" />
        </span>
      </div>
      <div className="flex flex-col gap-px bg-[#3a3a3c] px-2.5 py-2">
        <span className="truncate text-[12px] font-semibold leading-tight">{title}</span>
        <span className={cn("truncate text-[10.5px]", GRAY)}>{domain}</span>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div className="flex items-center gap-2 bg-black px-2.5 pt-1.5 pb-7">
      <span className={cn("inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#1c1c1e]", GRAY)}>
        <PlusIcon width={17} height={17} strokeWidth={2.2} />
      </span>
      <span className={cn("flex h-[31px] flex-1 items-center justify-between rounded-full border border-[#3a3a3c] pr-[3px] pl-3 text-[12.5px]", GRAY)}>
        iMessage
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#0a84ff] text-white">
          <ArrowUpIcon width={13} height={13} strokeWidth={3} />
        </span>
      </span>
    </div>
  );
}
