"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStepLoop } from "./use-step-loop";

/*
 * Client pieces of the "Try it live" bento: a copy chip and the chat demo
 * with an inline approval. The demo restarts its CSS animations by keying
 * its content on the loop `cycle`, and pauses out of view through
 * `useStepLoop`.
 */

const d = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

/** One line to copy. The whole chip is the button. */
export function CopyChip({ text, display, className }: { text: string; display?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className={cn(
        "group flex w-full min-w-0 items-center gap-3 rounded-md border border-border bg-foreground px-4 py-3 text-left font-mono text-[13px] text-background transition-colors outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
      aria-label={`Copy: ${text}`}
    >
      <span className="min-w-0 flex-1 truncate">{display ?? text}</span>
      <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-semibold transition-colors", copied ? "text-brand-wordmark" : "bg-background/10 text-background group-hover:bg-background/20")}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The chat demo. An inline approval card, pressed, then the receipt.
// ---------------------------------------------------------------------------

export function ChatDemo({ className }: { className?: string }) {
  const { ref, cycle } = useStepLoop<HTMLDivElement>(1, { interval: 8000 });
  return (
    <div ref={ref} className={cn("flex min-w-0 flex-col gap-2.5 text-[13px] leading-snug", className)} aria-hidden>
      <div key={cycle} className="contents">
        <div className="landing-bubble ml-auto max-w-[85%] rounded-md rounded-br-sm bg-foreground px-3 py-2 text-background" style={d(200)}>
          Order the running shoes, size 10, from the Nike site.
        </div>
        <div className="landing-bubble mr-auto max-w-[90%] rounded-md rounded-bl-sm border border-border bg-background px-3 py-2 text-foreground" style={d(1000)}>
          They are $35 with shipping. I need your approval for that amount.
        </div>
        <div className="landing-bubble relative mr-auto w-full max-w-[92%]" style={d(1700)}>
          <div className="landing-vanish rounded-md border border-border bg-background p-3" style={d(4000)}>
            <div className="flex items-center gap-2.5">
              <Image src="/brand/agents/crossmint-agents-mark.svg" alt="" width={22} height={22} className="size-[22px] shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Your agent wants to use your card</p>
                <p className="text-[12px] text-muted-foreground">Running shoes · up to $35.00</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md border border-border px-2.5 py-2 text-[12px]">
              <span className="text-foreground">Visa •••• 4242</span>
              <span className="text-muted-foreground">Default</span>
            </div>
            <div className="landing-press mt-3 flex h-9 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground" style={d(3400)}>
              Allow $35.00
            </div>
            <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Lock className="size-3" /> The agent never sees your card number
            </p>
          </div>
          <div className="landing-fade absolute inset-0 flex flex-col justify-center gap-2 rounded-md border border-primary/40 bg-muted p-4" style={d(4100)}>
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <svg viewBox="0 0 24 24" className="size-5 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" className="landing-draw" style={d(4300)} />
              </svg>
              Approved. $35.00 on Visa •••• 4242
            </p>
            <p className="text-[12px] text-muted-foreground">The agent checks out on your behalf and sends the receipt here.</p>
            <div className="landing-fade mt-1 flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-[12px]" style={d(5300)}>
              <span className="font-semibold text-foreground">Ordered · Nike</span>
              <span className="text-muted-foreground">$35.00 · #NK-88213</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
