"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { type ChatMessage, IMessageScreen } from "./chat";
import { CheckIcon, LockIcon } from "./chat/icons";
import { Receipt } from "./message-thread-mock";
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
  receiptCard: 9100,
  loop: 12400,
};

const STEPS = ["Opened starbucks.com", "Signed in", "Grande Latte added", "Paid with Visa •••• 4242", "Order placed · Pickup in 6 min"];
const OPTIONS = ["Visa •••• 4242", "Shop Pay", "Starbucks saved card"];

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/**
 * The agent buys a latte. An iMessage thread on a phone: the agent offers
 * payment methods in a list card, the user picks Visa, then a progress card
 * ticks through the checkout and the receipt lands. Beside it on large
 * screens, a browser window logs the same steps: the automation the user
 * never sees.
 */
export function CheckoutRunMock({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: T.loop });
  return (
    <div ref={ref} className={cn("relative flex items-center gap-5 lg:gap-6", className)}>
      <div aria-hidden className="landing-glow absolute -inset-10 -z-10" />
      <div key={cycle} className="contents">
        <PhoneFrame
          width={270}
          className="mx-0 shrink"
          screenClassName="bg-black"
          label="An iMessage thread: the agent buys a latte at Starbucks, the user picks Visa from a list, a progress card checks off each step, and the receipt arrives"
        >
          <IMessageScreen name="Your agent" messages={messages()} />
        </PhoneFrame>
        <AutomationWindow className="hidden min-w-0 flex-1 self-center lg:block" />
      </div>
    </div>
  );
}

/* ---------- Phone ---------- */

function messages(): ChatMessage[] {
  return [
    { key: "buying", from: "agent", at: T.buying, node: <>Buying your latte at Starbucks…</> },
    { key: "ask", from: "agent", at: T.ask, card: <OptionsCard /> },
    { key: "reply", from: "user", at: T.reply, node: <>Visa •••• 4242</> },
    { key: "card", from: "agent", at: T.card, card: <ProgressCard /> },
    { key: "done", from: "agent", at: T.receipt, node: <>Ordered. Pickup in 6 min.</> },
    { key: "receipt", from: "agent", at: T.receiptCard, card: <Receipt /> },
  ];
}

/** A tappable list inside a gray bubble. The first option fills in at `T.pick`. */
function OptionsCard() {
  return (
    <span className="flex flex-col text-[12.5px]">
      <span className="px-3 pt-2 pb-1.5 font-medium">Which payment method?</span>
      {OPTIONS.map((label, i) => {
        const picked = i === 0;
        return (
          <span key={label} className={cn("flex items-center justify-between gap-3 border-t border-white/10 px-3 py-[7px]", picked && "landing-pick")} style={picked ? delay(T.pick) : undefined}>
            <span>{label}</span>
            <span className="relative inline-flex size-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/30">
              {picked ? (
                <span className="landing-pop absolute inset-[-1.5px] inline-flex items-center justify-center rounded-full bg-[#0a84ff] text-white" style={delay(T.pick)}>
                  <CheckIcon width={10} height={10} />
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Compact progress card: five steps that check off one by one. */
function ProgressCard() {
  const last = T.steps[T.steps.length - 1] ?? T.card;
  return (
    <span className="flex flex-col gap-1.5 px-3 py-2.5 text-[11.5px]">
      <span className="flex items-center justify-between text-[10px] font-semibold tracking-wide text-[#8e8e93] uppercase">
        <span className="inline-flex items-center gap-1">
          <LockIcon width={10} height={10} strokeWidth={2.5} />
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
          <LockIcon width={12} height={12} strokeWidth={2.5} className="shrink-0" />
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
    <span className={cn("flex items-start gap-2 leading-tight", mono ? "text-[11px] text-foreground" : "text-white")}>
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
        <Spinner />
      </Layer>
      <Layer className="landing-pop" style={delay(at)}>
        <span className="inline-flex size-full items-center justify-center rounded-full bg-[#30d158] text-white">
          <CheckIcon className="size-[70%]" strokeWidth={3.5} />
        </span>
      </Layer>
    </span>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-full animate-spin text-[#0a84ff]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function Layer({ className, style, children }: { className: string; style: CSSProperties; children: ReactNode }) {
  return (
    <span className={cn("absolute inset-0 inline-flex items-center justify-center", className)} style={style}>
      {children}
    </span>
  );
}
