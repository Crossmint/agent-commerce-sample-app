"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApproveScreen, ApproveScreenMock } from "./approve-screen-mock";
import { BRANDS, type BrandId } from "./brands";
import { MessageThreadMock, MessageThreadScreen, THREAD_SCREEN_BG } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { ScreenStack, StepDots, StepPhone } from "./step-ui";
import { useStepLoop } from "./use-step-loop";

const STEPS = [
  "The user asks. The agent requests a budget on their card.",
  "The user approves once, on your domain.",
  "The agent pays and sends the receipt.",
];

/**
 * Three fictional brands, one flow, three steps. The brand tabs restyle the
 * thread domain, the approval layout, and the confirmation. The steps loop:
 * three phones on wide screens with the active one highlighted, one phone with
 * a screen crossfade on small ones.
 */
export function BrandSwitcher() {
  const [active, setActive] = useState<BrandId>("goat");
  // Bumps on each brand change so the threads replay in the new skin.
  const [switches, setSwitches] = useState(0);
  const { ref, step, cycle, jump } = useStepLoop<HTMLDivElement>(3, { interval: 2500, hold: 600 });
  const brand = BRANDS.find((b) => b.id === active) ?? BRANDS[0]!;

  const pick = (id: BrandId) => {
    if (id === active) return;
    setActive(id);
    setSwitches((n) => n + 1);
    jump(0);
  };

  const replay = `${cycle}-${switches}`;
  // The receipt lands when its step comes up, so it is keyed on that too.
  const replayDone = `${replay}-${step === 2}`;
  const threadLabel = (variant: "request" | "confirmation") =>
    variant === "request" ? `A thread: the agent asks for $8 with a link to ${brand.domain}` : "A thread: the agent confirms the order and sends the receipt";

  return (
    <div ref={ref} className="flex flex-col gap-6">
      <div role="tablist" aria-label="Brand" className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-md border border-border bg-background p-1">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={b.id === active}
            onClick={() => pick(b.id)}
            className={cn(
              "rounded-sm px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              b.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div
        data-brand={brand.id}
        style={brand.vars}
        className="landing-theme goat-backdrop rounded-md border border-border bg-background px-3 py-6 text-foreground sm:p-8 lg:p-10"
      >
        {/* Three phones from sm up. */}
        <div className="mx-auto hidden w-full max-w-[880px] grid-cols-3 items-end gap-3 sm:grid md:gap-6 lg:gap-8">
          <StepPhone active={step === 0} onClick={() => jump(0)} label={`Show step 1: ${STEPS[0]}`}>
            <MessageThreadMock key={replay} style={brand.threadStyle} variant="request" domain={brand.domain} width={260} label={threadLabel("request")} />
          </StepPhone>
          <StepPhone active={step === 1} onClick={() => jump(1)} label={`Show step 2: ${STEPS[1]}`}>
            <ApproveScreenMock brand={brand} width={260} />
          </StepPhone>
          <StepPhone active={step === 2} onClick={() => jump(2)} label={`Show step 3: ${STEPS[2]}`}>
            <MessageThreadMock key={replayDone} style={brand.threadStyle} variant="confirmation" domain={brand.domain} width={260} label={threadLabel("confirmation")} />
          </StepPhone>
        </div>

        {/* One phone below sm. The screen crossfades and slides between steps. */}
        <div className="flex flex-col items-center gap-4 sm:hidden">
          <PhoneFrame
            width={260}
            statusTone={step === 1 && brand.tone === "light" ? "dark" : "light"}
            screenClassName={step === 1 ? (brand.tone === "light" ? "bg-[#f2f2f7]" : "bg-[#1c1c1e]") : THREAD_SCREEN_BG[brand.threadStyle]}
            label={`A phone that steps through the ${brand.name} flow: ask, approve, receipt`}
          >
            <ScreenStack active={step}>
              <MessageThreadScreen key={replay} style={brand.threadStyle} variant="request" domain={brand.domain} />
              <ApproveScreen brand={brand} />
              <MessageThreadScreen key={replayDone} style={brand.threadStyle} variant="confirmation" domain={brand.domain} />
            </ScreenStack>
          </PhoneFrame>
          <StepDots count={3} active={step} onPick={jump} labels={STEPS} />
        </div>
      </div>

      <ol className="mx-auto grid w-full max-w-[880px] gap-2 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex">
            <button
              type="button"
              onClick={() => jump(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:flex-col sm:gap-2 sm:px-0 sm:text-center sm:items-center",
                i === step ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("font-mono text-sm font-semibold tabular-nums", i === step ? "text-primary" : "")}>{i + 1}.</span>
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
