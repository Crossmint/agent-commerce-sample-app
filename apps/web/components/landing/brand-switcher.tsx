"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { APPROVE_SCREEN_BG, ApproveScreen, ApproveScreenMock } from "./approve-screen-mock";
import { type AgentBrand, type BrandId, BRANDS } from "./brands";
import { CHAT_APP_NAME, CHAT_SCREEN_BG } from "./chat";
import { MessageThreadMock, MessageThreadScreen } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { ScreenStack, StepDots, StepPhone } from "./step-ui";
import { useStepLoop } from "./use-step-loop";

const STEPS = [
  "The user asks. The agent requests a budget on their card.",
  "The user approves once, on your domain.",
  "The agent pays and sends the receipt.",
];

/**
 * Three agent brands, one flow, three steps. The brand tabs switch the chat
 * app, the approval layout, and the domain. The steps loop: three phones on
 * wide screens with the active one highlighted, one phone with a screen
 * crossfade on small ones.
 */
export function BrandSwitcher() {
  const [active, setActive] = useState<BrandId>("instinct");
  // Bumps on each brand change so the threads replay in the new skin.
  const [switches, setSwitches] = useState(0);
  const { ref, step, cycle, jump } = useStepLoop<HTMLDivElement>(3, { interval: 2800, hold: 800 });
  const brand: AgentBrand = BRANDS.find((b) => b.id === active) ?? BRANDS[0]!;

  const pick = (id: BrandId) => {
    if (id === active) return;
    setActive(id);
    setSwitches((n) => n + 1);
    jump(0);
  };

  const replay = `${cycle}-${switches}`;
  // The receipt lands when its step comes up, so it is keyed on that too.
  const replayDone = `${replay}-${step === 2}`;
  const app = CHAT_APP_NAME[brand.chatStyle];
  const threadLabel = (variant: "request" | "confirmation") =>
    variant === "request" ? `A ${app} thread: ${brand.name} asks for $8 with a link to ${brand.domain}` : `A ${app} thread: ${brand.name} confirms the order and sends the receipt`;
  const thread = { style: brand.chatStyle, agentName: brand.name, logo: brand.logo, domain: brand.domain } as const;

  return (
    <div ref={ref} className="flex flex-col gap-8">
      <div role="tablist" aria-label="Brand" className="flex w-fit max-w-full flex-wrap gap-1 rounded-md border border-border bg-background p-1">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            aria-selected={b.id === active}
            onClick={() => pick(b.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm px-3.5 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              b.id === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Image src={b.logo} alt="" width={16} height={16} className="size-4 shrink-0 object-contain" />
            {b.name}
          </button>
        ))}
      </div>

      {/* Three phones from sm up. */}
      <div className="hidden w-full max-w-[880px] grid-cols-3 items-end gap-3 sm:grid md:gap-6 lg:gap-8">
        <StepPhone active={step === 0} onClick={() => jump(0)} label={`Show step 1: ${STEPS[0]}`}>
          <MessageThreadMock key={replay} {...thread} variant="request" width={260} label={threadLabel("request")} />
        </StepPhone>
        <StepPhone active={step === 1} onClick={() => jump(1)} label={`Show step 2: ${STEPS[1]}`}>
          <ApproveScreenMock brand={brand} width={260} />
        </StepPhone>
        <StepPhone active={step === 2} onClick={() => jump(2)} label={`Show step 3: ${STEPS[2]}`}>
          <MessageThreadMock key={replayDone} {...thread} variant="confirmation" width={260} label={threadLabel("confirmation")} />
        </StepPhone>
      </div>

      {/* One phone below sm. The screen crossfades and slides between steps. */}
      <div className="flex flex-col gap-4 sm:hidden">
        <PhoneFrame
          width={260}
          className="mx-0"
          statusTone={step === 1 && brand.tone === "light" ? "dark" : "light"}
          screenClassName={step === 1 ? APPROVE_SCREEN_BG[brand.tone] : CHAT_SCREEN_BG[brand.chatStyle]}
          label={`A phone that steps through the ${brand.name} flow: ask, approve, receipt`}
        >
          <ScreenStack active={step}>
            <MessageThreadScreen key={replay} {...thread} variant="request" />
            <ApproveScreen brand={brand} />
            <MessageThreadScreen key={replayDone} {...thread} variant="confirmation" />
          </ScreenStack>
        </PhoneFrame>
        <StepDots count={3} active={step} onPick={jump} labels={STEPS} />
      </div>

      <ol className="grid w-full max-w-[880px] gap-2 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((s, i) => (
          <li key={s} className="flex">
            <button
              type="button"
              onClick={() => jump(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex w-full items-start gap-3 rounded-md py-1 text-left text-sm leading-snug transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:flex-col sm:gap-2",
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
