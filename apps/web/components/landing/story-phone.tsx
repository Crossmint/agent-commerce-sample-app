"use client";

import { cn } from "@/lib/cn";
import { LandingPhone } from "./landing-phone";
import { AgentChatScreen, checkoutThread, CHECKOUT_T, requestThread } from "./screen-chat";
import { APPROVE_T, ApproveScreen } from "./screen-approve";
import { ScreenStack, useActivationKeys } from "./step-ui";
import { STORY } from "./story";
import { useStepLoop } from "./use-step-loop";

/*
 * The whole story in one phone, four screens:
 * 0. The chat. The user asks, the agent asks for $35 and sends the request.
 * 1. The approval sheet slides up. Allow pulses and is pressed.
 * 2. Approved. The check draws.
 * 3. The chat again: the checkout runs step by step, the receipt lands.
 */
const STEPS = 4;
const DURATIONS = [3400, APPROVE_T.press + 900, 2000, CHECKOUT_T.receipt + 2600];
/** Under reduced motion only the approval sheet and the finished thread show. */
const REDUCED = [1, 3];

const LABEL = `A phone that plays the flow: the user asks ${STORY.agent} to ${STORY.ask.toLowerCase()}, the agent asks for a ${STORY.amount} budget, the approval sheet shows the purpose, the limit and the card, the user allows it, the checkout runs at ${STORY.domain} and a receipt for ${STORY.receipt.total} arrives`;

/** The hero phone. It plays while in view and starts over each time it comes back. */
export function StoryPhone({ className }: { className?: string }) {
  const { ref, step, cycle } = useStepLoop<HTMLDivElement>(STEPS, {
    durations: DURATIONS,
    reducedSteps: REDUCED,
  });
  const keys = useActivationKeys(step, cycle, STEPS);
  return (
    <div ref={ref} className={cn("flex", className)}>
      <LandingPhone label={LABEL}>
        <ScreenStack active={step}>
          <AgentChatScreen key={keys[0]} messages={requestThread({ pressAt: 3000 })} />
          <ApproveScreen key={keys[1]} state="request" />
          <ApproveScreen key={keys[2]} state="approved" />
          <AgentChatScreen key={keys[3]} messages={checkoutThread()} />
        </ScreenStack>
      </LandingPhone>
    </div>
  );
}
