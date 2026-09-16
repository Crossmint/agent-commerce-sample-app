"use client";

import type { CSSProperties, ReactNode } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { type Bubble, WhatsAppBubble, WhatsAppComposer, WhatsAppHeader } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { useStepLoop } from "./use-step-loop";

/*
 * One timeline in ms, shared by the phone and the browser window. Everything
 * is CSS animation with delays, so a single remount replays the whole run
 * and reduced motion shows the final state with no JS.
 */
const T = {
  buying: 300,
  ask: 1200,
  pick: 2600,
  reply: 3200,
  card: 4000,
  steps: [4600, 5400, 6200, 7000, 7800],
  receipt: 8600,
  loop: 11800,
};

const STEPS = ["Opened starbucks.com", "Signed in", "Grande Latte added", "Paid with Visa •••• 4242", "Order placed · Pickup in 6 min"];

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/**
 * The agent buys a latte. A WhatsApp thread on a phone: the agent picks a
 * payment method with the user, then a progress card ticks through the
 * checkout and the receipt lands. Beside it on large screens, a browser window
 * logs the same steps: the automation the user never sees.
 */
export function CheckoutRunMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: T.loop });
  return (
    <div ref={ref} className={cn("relative flex items-center justify-center gap-5 lg:justify-start lg:gap-6", className)}>
      <div aria-hidden className="landing-glow absolute -inset-10 -z-10" />
      <div key={cycle} className="contents">
        <PhoneFrame
          width={270}
          className="shrink"
          screenClassName="bg-[#075e54]"
          label="A WhatsApp thread: the agent buys a latte at Starbucks, the user picks Visa, a progress card checks off each step, and the receipt arrives"
        >
          <CheckoutThread />
        </PhoneFrame>
        <AutomationWindow className="hidden min-w-0 flex-1 self-center lg:block" />
      </div>
    </div>
  );
}

/* ---------- Phone ---------- */

function CheckoutThread() {
  const bubbles: Bubble[] = [
    { key: "buying", from: "agent", at: T.buying, node: <>Buying your latte at Starbucks…</> },
    {
      key: "ask",
      from: "agent",
      at: T.ask,
      node: (
        <>
          Which payment method?
          <span className="mt-1.5 mb-0.5 flex flex-wrap gap-1.5">
            <Chip label="Visa •••• 4242" picked />
            <Chip label="Shop Pay" />
            <Chip label="Starbucks saved card" />
          </span>
        </>
      ),
    },
    { key: "reply", from: "user", at: T.reply, node: <>Visa •••• 4242</> },
    { key: "card", from: "agent", at: T.card, node: <ProgressCard /> },
    {
      key: "receipt",
      from: "agent",
      at: T.receipt,
      node: (
        <>
          Ordered. Pickup in 6 min.
          <span className="mt-1.5 mb-0.5 flex items-center justify-between gap-3 rounded-md bg-black/25 px-2.5 py-2 text-[11.5px]">
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">Starbucks</span>
              <span className="opacity-70">Grande Latte</span>
            </span>
            <span className="font-semibold tabular-nums">$6.45</span>
          </span>
        </>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col font-sans text-[13px] text-white">
      <WhatsAppHeader name="Your agent" />
      {/* Pinned to the bottom like a real chat: when the run outgrows the screen, the oldest bubbles leave at the top. */}
      <div className="landing-wa-doodle flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div className="flex flex-1 flex-col gap-1.5 px-2.5 pt-2.5 pb-1">
          <span className="mx-auto mb-1 rounded-md bg-[#182229] px-2 py-0.5 text-[10px] font-medium text-[#8696a0]">Today</span>
          {bubbles.map((b) => (
            <div key={b.key} className="landing-bubble flex flex-col" style={delay(b.at)}>
              <WhatsAppBubble b={b} />
            </div>
          ))}
        </div>
      </div>
      <WhatsAppComposer />
    </div>
  );
}

/** A tappable-looking option. The picked one fills in at `T.pick`. */
function Chip({ label, picked = false }: { label: string; picked?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-[11px] leading-none font-medium text-[#e9edef]",
        picked && "landing-pick",
      )}
      style={picked ? delay(T.pick) : undefined}
    >
      {picked ? (
        <span className="landing-pop inline-flex" style={delay(T.pick)}>
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      {label}
    </span>
  );
}

/** Compact progress card: five steps that check off one by one. */
function ProgressCard() {
  const last = T.steps[T.steps.length - 1] ?? T.card;
  return (
    <span className="mt-0.5 mb-0.5 flex w-[190px] max-w-full flex-col gap-1.5 rounded-md bg-black/25 px-2.5 py-2 text-[11px]">
      <span className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-[#8696a0] uppercase">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-2.5" strokeWidth={2.5} />
          starbucks.com
        </span>
        <RunMark from={T.card} at={last} size="size-3" />
      </span>
      {STEPS.map((label, i) => (
        <RunStep key={label} label={label} from={i === 0 ? T.card : (T.steps[i - 1] ?? T.card)} at={T.steps[i] ?? last} />
      ))}
    </span>
  );
}

/* ---------- Browser window ---------- */

function AutomationWindow({ className }: { className?: string }) {
  return (
    <div className={cn("goat-window max-w-[300px] text-[12px]", className)} aria-hidden>
      <div className="flex flex-col gap-3 p-4 font-mono">
        <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          <Lock className="size-3 shrink-0" strokeWidth={2.5} />
          starbucks.com/checkout
        </p>
        <ol className="flex flex-col gap-2">
          {STEPS.map((label, i) => {
            const from = i === 0 ? T.card : (T.steps[i - 1] ?? T.card);
            return (
              <li key={label} className="landing-fade" style={delay(from)}>
                <RunStep label={label} from={from} at={T.steps[i] ?? T.receipt} mono />
              </li>
            );
          })}
        </ol>
        <p className="landing-fade text-[11px] text-muted-foreground" style={delay(T.receipt)}>
          Receipt sent to the user.
        </p>
      </div>
    </div>
  );
}

/* ---------- Shared pieces ---------- */

/**
 * One step in a run. A hollow dot until `from`, a spinner from `from` to `at`,
 * a check from `at`. The label brightens at `at`.
 */
function RunStep({ label, from, at, mono = false }: { label: string; from: number; at: number; mono?: boolean }) {
  return (
    <span className={cn("flex items-start gap-2 leading-tight", mono ? "text-[11px] text-foreground" : "text-[#e9edef]")}>
      <RunMark from={from} at={at} className={mono ? "mt-px" : undefined} />
      <span className={cn("landing-bright min-w-0", mono ? "" : "truncate")} style={delay(at)}>
        {label}
      </span>
    </span>
  );
}

function RunMark({ from, at, size = "size-3.5", className }: { from: number; at: number; size?: string; className?: string }) {
  const dur = Math.max(at - from, 1);
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", size, className)}>
      <Layer className="landing-vanish" style={delay(from)}>
        <span className="block size-[9px] rounded-full border-[1.5px] border-current opacity-45" />
      </Layer>
      <Layer className="landing-window" style={{ ...delay(from), "--dur": `${dur}ms` } as CSSProperties}>
        <Loader2 className="size-full animate-spin text-[#53bdeb]" strokeWidth={2.5} />
      </Layer>
      <Layer className="landing-pop" style={delay(at)}>
        <span className="inline-flex size-full items-center justify-center rounded-full bg-[#00a884] text-white">
          <Check className="size-[70%]" strokeWidth={3.5} />
        </span>
      </Layer>
    </span>
  );
}

function Layer({ className, style, children }: { className: string; style: CSSProperties; children: ReactNode }) {
  return (
    <span className={cn("absolute inset-0 inline-flex items-center justify-center", className)} style={style}>
      {children}
    </span>
  );
}
