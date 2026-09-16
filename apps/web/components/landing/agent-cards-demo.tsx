"use client";

import { cn } from "@/lib/cn";
import { ApproveScreen, ApproveScreenMock } from "./approve-screen-mock";
import { MessageThreadMock, MessageThreadScreen } from "./message-thread-mock";
import { PhoneFrame } from "./phone-frame";
import { ScreenStack, StepDots, StepPhone } from "./step-ui";
import { useStepLoop } from "./use-step-loop";

const DOMAIN = "yourplatform.com";

const CAPTIONS = ["The user asks. The agent sends an approval link.", `The user approves once, on ${DOMAIN}.`, "The agent has $8 on the user's card."];

/**
 * The Agent Cards experience as a three-step loop. Step 0: the thread, ask
 * and link. Step 1: the approval screen. Step 2: the thread again, with the
 * "You approved" line. Two phones on wide screens, one phone with a screen
 * crossfade on small ones.
 */
export function AgentCardsDemo({ className }: { className?: string }) {
  const { ref, step, cycle, jump } = useStepLoop<HTMLDivElement>(3, { interval: 2500, hold: 600 });
  const variant = step === 2 ? "approved" : "request";
  const onThread = step !== 1;

  return (
    <div ref={ref} className={cn("relative flex flex-col items-center gap-5", className)}>
      <div aria-hidden className="landing-glow absolute -inset-10 -z-10" />

      {/* Two phones from sm up. */}
      <div className="hidden w-full max-w-[520px] grid-cols-2 items-end gap-4 sm:grid sm:gap-6">
        <StepPhone active={onThread} onClick={() => jump(step === 2 ? 2 : 0)} label="Show the message thread">
          <MessageThreadMock key={cycle} style="imessage" variant={variant} domain={DOMAIN} width={250} />
        </StepPhone>
        <StepPhone active={!onThread} onClick={() => jump(1)} label="Show the approval screen">
          <ApproveScreenMock domain={DOMAIN} width={250} />
        </StepPhone>
      </div>

      {/* One phone below sm. The screen crossfades. */}
      <div className="w-full sm:hidden">
        <PhoneFrame width={260} screenClassName="bg-[#1c1c1e]" label="A phone that switches between the message thread and the approval screen">
          <ScreenStack active={onThread ? 0 : 1}>
            <MessageThreadScreen key={cycle} style="imessage" variant={variant} domain={DOMAIN} />
            <ApproveScreen domain={DOMAIN} />
          </ScreenStack>
        </PhoneFrame>
      </div>

      <div className="flex flex-col items-center gap-2">
        <StepDots count={3} active={step} onPick={jump} labels={CAPTIONS} />
        <p className="min-h-[1.5em] text-center text-sm text-muted-foreground" aria-live="polite">
          {CAPTIONS[step]}
        </p>
      </div>
    </div>
  );
}
